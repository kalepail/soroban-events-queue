import type { SorobanRpc } from "soroban-client/lib/soroban_rpc"
import type { Env } from "./types"
import { processEvents, processDLQ } from "./queue"

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        let id = env.EVENTPOLL.idFromName('HEARTBEAT')
        return env.EVENTPOLL.get(id).fetch(request)
    },

    async scheduled(_event: ScheduledEvent, env: Env): Promise<Response> {
        let id = env.EVENTPOLL.idFromName('HEARTBEAT')
        return env.EVENTPOLL.get(id).fetch('/')
    },

    async queue(batch: MessageBatch<SorobanRpc.EventResponse>, env: Env): Promise<void> {
        switch (batch.queue) {
            case 'event-listener':
                await processEvents(batch, env)
                break;
            case 'event-listener-dlq':
                await processDLQ(batch, env)
                break;
            default:
                throw new Error(`Unknown queue: ${batch.queue}`)
        }
    }
}

export { EventPoll } from './eventpoll'