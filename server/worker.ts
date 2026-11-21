import { paymentConfig, reconcilePayments } from "./payments/razorpay.ts";
import "server-only";
import { setTimeout as sleep } from "node:timers/promises";
import type { KafkaJS } from "@confluentinc/kafka-javascript";
import { expireDueHolds } from "./commerce/commands.ts";
import { createCommerceFacts } from "./commerce/facts.ts";
import type { CommerceEvent, WriteProjection } from "./contracts/events.ts";
import type { Database } from "./db/database.ts";
import { eventKey, relayOnce } from "./events/outbox.ts";
import { handleDelivery } from "./events/project.ts";

export function createEventProducer(kafka: KafkaJS.Kafka) {
  return kafka.producer({
    kafkaJS: { acks: -1, idempotent: true },
    "allow.auto.create.topics": false,
    "message.timeout.ms": 10_000,
  });
}

export async function publishEvent(producer: KafkaJS.Producer, topic: string, event: CommerceEvent) {
  const ack = await producer.send({ topic, messages: [{ key: eventKey(event), value: JSON.stringify(event) }] });
  if (!ack.length || ack.some((record) => record.errorCode !== 0)) throw new Error("Broker did not acknowledge publication");
}

async function wait(ms: number, signal: AbortSignal) {
  try {
    await sleep(ms, undefined, { signal });
  } catch (error) {
    if (!signal.aborted) throw error;
  }
}

interface WorkerOptions {
  db: Database;
  kafka: KafkaJS.Kafka;
  topic: string;
  groupId: string;
  writeProjection: WriteProjection;
  signal: AbortSignal;
}

export async function runWorker({ db, kafka, topic, groupId, writeProjection, signal }: WorkerOptions): Promise<void> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(topic)
      || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(groupId)) {
    throw new Error("Set explicit Kafka topic and group names");
  }
  signal.throwIfAborted();
  await db.transact(async (client) => { await client.query("SELECT 1 FROM outbox LIMIT 0"); });
  const { readProductFacts } = createCommerceFacts(db);
  const producer = createEventProducer(kafka);
  const consumer = kafka.consumer({
    kafkaJS: { groupId, fromBeginning: true, autoCommit: false },
    "allow.auto.create.topics": false,
    "js.consumer.max.batch.size": 16,
  });

  let producerConnected = false;
  try {
    await producer.connect();
    producerConnected = true;
    if (signal.aborted) return;
    await consumer.connect();
    if (signal.aborted) return;
    await consumer.subscribe({ topics: [topic] });
    let blockedOffset: string | undefined;
    let retryDelay = 250;
    await consumer.run({
      eachBatchAutoResolve: false,
      eachBatch: async ({ batch, resolveOffset, isStale, isRunning }) => {
        for (const message of batch.messages) {
          if (signal.aborted || isStale() || !isRunning()) return;
          const delivery = { topic, partition: batch.partition, offset: message.offset, key: message.key, value: message.value };
          try {
            const handled = await handleDelivery(db, readProductFacts, writeProjection, delivery, signal) !== "retry";
            if (handled && !signal.aborted && !isStale() && isRunning()) {
              await consumer.commitOffsets([{
                topic, partition: batch.partition, offset: (BigInt(message.offset) + BigInt(1)).toString(),
              }]);
              resolveOffset(message.offset);
              blockedOffset = undefined;
              retryDelay = 250;
              continue;
            }
          } catch {
            if (!signal.aborted) console.error("Projection handling or offset commit failed");
          }
          const location = `${batch.partition}:${message.offset}`;
          if (blockedOffset !== location) retryDelay = 250;
          blockedOffset = location;
          await wait(retryDelay, signal);
          retryDelay = Math.min(5_000, retryDelay * 2);
          // The unresolved offset is replayed by the pinned Confluent client.
          return;
        }
      },
    });

    const relay = async () => {
      while (!signal.aborted) {
        try {
          if (await relayOnce(db, (event) => publishEvent(producer, topic, event))) continue;
        } catch {
          console.error("Outbox relay database operation failed");
        }
        await wait(500, signal);
      }
    };
    const paymentSweep = async () => {
      const config = paymentConfig();
      if (!config) return;
      while (!signal.aborted) {
        try {
          await reconcilePayments(db, config);
        } catch {
          console.error("[payments] Could not read reconciliation queue");
        }
        await wait(5_000, signal);
      }
    };

    const sweep = async () => {
      while (!signal.aborted) {
        try {
          await expireDueHolds(db, 24);
        } catch {
          console.error("Hold expiry sweep failed");
        }
        await wait(1_000, signal);
      }
    };
    await Promise.all([relay(), sweep(), paymentSweep()]);
  } finally {
    const shutdown = await Promise.allSettled([
      consumer.disconnect(),
      (async () => {
        try {
          if (producerConnected) await producer.flush({ timeout: 10_000 });
        } finally {
          await producer.disconnect();
        }
      })(),
    ]);
    if (shutdown.some((result) => result.status === "rejected")) {
      throw new Error("Kafka shutdown did not complete cleanly");
    }
  }
}
