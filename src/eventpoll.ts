import type { Env } from "./types"
import { getLatestLedger, getEvents } from "./rpc"
import { nextFiveSecondMark } from "./utils"

export class EventPoll implements DurableObject {
    env: Env
    state: DurableObjectState
    storage: DurableObjectStorage
    cursor: number | string | undefined
    alarm_running: boolean = false

    constructor(state: DurableObjectState, env: Env) {
        this.env = env
        this.state = state
        this.storage = state.storage
        this.state.blockConcurrencyWhile(async () => {
            this.cursor = await this.state.storage.get('cursor')
        })
        this.state.setWebSocketAutoResponse(
            new WebSocketRequestResponsePair('ping', 'pong')
        )
    }

    async fetch(request: Request) {
        const url = new URL(request.url)

        if (url.pathname.includes('ws')) {
            const { 0: client, 1: server } = new WebSocketPair() // new WebSocket(url.toString())
            this.state.acceptWebSocket(server)

            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }

        else if (url.pathname.includes('reset')) {
            await this.storage.deleteAlarm()
            await this.storage.deleteAll()
            this.cursor = undefined
            this.alarm_running = false
        }

        else if (
            !this.alarm_running
            && await this.storage.getAlarm() === null
        ) {
            let { sequence } = await getLatestLedger()
            let ledger = sequence - 17280 + 1 // latest ledger - 24 hours worth of ledgers + 1 ledger

            let { events } = await getEvents(ledger, 1)
            let cursor = events[0]?.pagingToken || ledger

            this.cursor = cursor
            await this.storage.put('cursor', cursor)
            await this.alarm()
        }

        return new Response(null, { status: 204 })
    }

    async alarm() {
        try {
            // Setting the timestamp first ensures we stick to a 5 second interval as much as possible in case the alarm takes awhile to process
            const now = new Date()

            this.alarm_running = true

            let cursor = this.cursor

            const result = await getEvents(cursor)

            console.log(cursor);
            console.log(result.events.length);
            // console.log(JSON.stringify(result, null, 2))

            if (result.events.length) {
                await this.env.QUEUE.sendBatch(result.events.map((event) => ({ body: event })))

                for (const ws of this.state.getWebSockets()) {
                    ws.send(JSON.stringify(result.events, null, 2))
                }

                cursor = result.events[result.events.length - 1].pagingToken
            } else {
                cursor = Number(result.latestLedger)
            }

            this.cursor = cursor
            this.alarm_running = false
            await this.storage.put('cursor', cursor)
            await this.storage.setAlarm(nextFiveSecondMark(now))
        } catch (err) {
            this.alarm_running = false
            console.error(JSON.stringify(err, null, 2))
        }
    }
}