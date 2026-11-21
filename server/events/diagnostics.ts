import "server-only";
import type { PipelineFacts, ReadPipelineFacts } from "../contracts/events.ts";
import type { Database } from "../db/database.ts";

export function createPipelineReader(db: Database): ReadPipelineFacts {
  return (storeId) => db.transact(async (client) => {
    await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const { rows: [summary] } = await client.query<Omit<PipelineFacts, "storeId" | "recentEvents">>(`
      SELECT statement_timestamp() AS "checkedAt",
        (SELECT count(*)::int FROM outbox WHERE store_id = $1 AND published_at IS NULL) AS "pendingCount",
        (SELECT min(occurred_at) FROM outbox WHERE store_id = $1 AND published_at IS NULL) AS "oldestPendingAt",
        (SELECT max(published_at) FROM outbox WHERE store_id = $1) AS "lastBrokerAckAt",
        (SELECT last_accepted_at FROM projection_progress WHERE store_id = $1) AS "lastProjectionAcceptedAt",
        (SELECT count(*)::int FROM projection_retry WHERE store_id = $1) AS "projectionRetryCount",
        (SELECT count(*)::int FROM projection_quarantine WHERE store_id = $1) AS "quarantineCount",
        (SELECT count(*)::int FROM projection_quarantine WHERE store_id IS NULL) AS "unattributedQuarantineCount",
        (SELECT jsonb_build_object('code', code, 'at', at) FROM (
          SELECT reason AS code, failed_at AS at FROM projection_retry WHERE store_id = $1
          UNION ALL
          SELECT last_error, last_error_at FROM outbox WHERE store_id = $1 AND published_at IS NULL
          UNION ALL
          SELECT reason, quarantined_at FROM projection_quarantine WHERE store_id = $1
        ) errors WHERE at IS NOT NULL ORDER BY at DESC LIMIT 1) AS "lastError"`, [storeId]);
    const { rows: recentEvents } = await client.query<PipelineFacts["recentEvents"][number]>(`
      SELECT id AS "eventId", type, occurred_at AS "occurredAt", published_at AS "publishedAt"
      FROM outbox WHERE store_id = $1 ORDER BY occurred_at DESC, id DESC LIMIT 20`, [storeId]);
    const utc = (value: string) => new Date(value).toISOString();
    return {
      ...summary, storeId,
      checkedAt: utc(summary.checkedAt),
      oldestPendingAt: summary.oldestPendingAt && utc(summary.oldestPendingAt),
      lastBrokerAckAt: summary.lastBrokerAckAt && utc(summary.lastBrokerAckAt),
      lastProjectionAcceptedAt: summary.lastProjectionAcceptedAt && utc(summary.lastProjectionAcceptedAt),
      lastError: summary.lastError && { ...summary.lastError, at: utc(summary.lastError.at) },
      recentEvents: recentEvents.map((row) => ({
        ...row, occurredAt: utc(row.occurredAt), publishedAt: row.publishedAt && utc(row.publishedAt),
      })),
    };
  });
}
