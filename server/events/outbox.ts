import "server-only";
import type { CommerceEvent } from "../contracts/events.ts";
import type { Database } from "../db/database.ts";

interface Claim {
  token: string;
  event: CommerceEvent;
}

export function eventKey(event: CommerceEvent): string {
  return event.type === "inventory.changed"
    ? `${event.payload.storeId}:${event.payload.productId}`
    : event.payload.orderId;
}

export async function claimOutbox(db: Database): Promise<Claim | undefined> {
  return db.transact(async (client) => {
    const { rows: [row] } = await client.query<{ token: string; event: CommerceEvent }>(`
      WITH next AS (
        SELECT id FROM outbox WHERE published_at IS NULL
          AND retry_at <= clock_timestamp()
          AND (lease_until IS NULL OR lease_until <= clock_timestamp())
        ORDER BY occurred_at, id
        LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox o SET lease_token = gen_random_uuid(), lease_until = clock_timestamp() + interval '30 seconds',
        attempts = attempts + 1
      FROM next WHERE o.id = next.id
      RETURNING o.lease_token AS token, jsonb_build_object(
        'eventId', o.id, 'schemaVersion', o.schema_version, 'type', o.type,
        'occurredAt', to_char(o.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'payload', o.payload) AS event`);
    return row;
  });
}

export async function markPublished(db: Database, claim: Claim): Promise<boolean> {
  return db.transact(async (client) => {
    const result = await client.query(`
      UPDATE outbox SET published_at = clock_timestamp(), lease_token = NULL, lease_until = NULL,
        last_error = NULL, last_error_at = NULL
      WHERE id = $1 AND lease_token = $2 AND lease_until > clock_timestamp() AND published_at IS NULL`,
    [claim.event.eventId, claim.token]);
    return result.rowCount === 1;
  });
}

async function deferPublication(db: Database, claim: Claim) {
  await db.transact(async (client) => {
    await client.query(`
      UPDATE outbox SET lease_token = NULL, lease_until = NULL,
        retry_at = clock_timestamp() + make_interval(secs => LEAST(30, 1 << LEAST(attempts - 1, 5))),
        last_error = 'BROKER_PUBLISH_FAILED', last_error_at = clock_timestamp()
      WHERE id = $1 AND lease_token = $2 AND lease_until > clock_timestamp() AND published_at IS NULL`,
    [claim.event.eventId, claim.token]);
  });
}

export async function relayOnce(db: Database, publish: (event: CommerceEvent) => Promise<void>): Promise<boolean> {
  const claim = await claimOutbox(db);
  if (!claim) return false;
  try {
    await publish(claim.event);
  } catch {
    await deferPublication(db, claim);
    return true;
  }
  await markPublished(db, claim);
  return true;
}
