import type { SorobanRpc } from "soroban-client/lib/soroban_rpc"

export type Env = {
    readonly EVENTS_KV: KVNamespace
    readonly EVENTS_SQL: D1Database
    readonly QUEUE: Queue<SorobanRpc.EventResponse>
    readonly EVENTPOLL: DurableObjectNamespace
    readonly ERROR_BUCKET: R2Bucket
    readonly RESET_CODE: string
}

export type getLatestLedgerResponse = {
    jsonrpc: "2.0"
    id: 1
    result: SorobanRpc.GetLatestLedgerResponse
}

export type getEventsResponse = {
    jsonrpc: "2.0"
    id: 1
    result: {
        events: SorobanRpc.EventResponse[],
        latestLedger: string
    }
}

export type rpcError = {
    jsonrpc: "2.0"
    id: 1
    error: {
        code: number
        message: string
    }
}