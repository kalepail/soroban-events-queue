import type { SorobanRpc } from "soroban-client";
import type { Env } from "./types";

export async function processDLQ(batch: MessageBatch<SorobanRpc.EventResponse>, env: Env): Promise<void> {
    await env.ERROR_BUCKET.put(`${Date.now()}.log`, JSON.stringify(batch.messages, null, 2));
}

export async function processEvents(batch: MessageBatch<SorobanRpc.EventResponse>, env: Env): Promise<void> {
    // Save to KV
    for (const message of batch.messages) {
        try {
            const { body: event } = message

            await env.EVENTS_KV.put(`${event.contractId}:${event.type}:${event.id}`, event.ledger, {
                metadata: {
                    topic: event.topic,
                    value: event.value.xdr
                }
            })

            message.ack()
        } catch (err) {
            message.retry()
            console.error(JSON.stringify(err, null, 2))
        }
    }

    // Also save to SQLite because why not!?
    const stmt = env.EVENTS_SQL.prepare(`
      INSERT OR IGNORE INTO "soroban-events" (id, type, ledger, contract_id, topic_1, topic_2, topic_3, topic_4, value)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `);

    await env.EVENTS_SQL.batch(batch.messages.map((message) => {
        const { body: event } = message

        return stmt.bind(
            event.id,
            event.type,
            event.ledger,
            event.contractId,
            event.topic[0] || null,
            event.topic[1] || null,
            event.topic[2] || null,
            event.topic[3] || null,
            event.value.xdr
        )
    }))
}