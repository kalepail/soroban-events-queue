import type { getLatestLedgerResponse, rpcError, getEventsResponse } from "./types"

export async function getLatestLedger() {
    return fetch('https://rpc-futurenet.stellar.org:443', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getLatestLedger'
        })
    })
        .then(async (res) => {
            if (res.ok) {
                return res.json()
            } else {
                throw await res.json()
            }
        })
        .then((res: any) => {
            if (res.result)
                return (res as getLatestLedgerResponse).result
            else
                throw (res as rpcError).error
        })
}

export async function getEvents(cursor: number | string | undefined, limit = 100) {
    return fetch('https://rpc-futurenet.stellar.org:443', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getEvents',
            params: {
                startLedger: typeof cursor === 'number' ? cursor.toString() : undefined,
                filters: [
                    {
                        type: 'contract',
                        // contractIds: [
                        //   '7dc1ecdf9335199fc9918dbe0c732ce1d1146aa8f29cc9c360afc6a747ae94df'
                        // ]
                    }
                ],
                pagination: {
                    limit,
                    cursor: typeof cursor === 'string' ? cursor : undefined
                }
            }
        })
    })
        .then(async (res) => {
            if (res.ok) {
                return res.json()
            } else {
                throw await res.json()
            }
        })
        .then((res: any) => {
            if (res.result)
                return (res as getEventsResponse).result
            else
                throw (res as rpcError).error
        })
}