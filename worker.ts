import type { SorobanRpc } from "soroban-client/lib/soroban_rpc"

type Env = {
  readonly QUEUE: Queue<SorobanRpc.EventResponse>
  readonly EVENTS: D1Database
  readonly EVENTPOLL: DurableObjectNamespace
}

type getLatestLedgerResponse = {
  jsonrpc: "2.0"
  id: 1
  result: SorobanRpc.GetLatestLedgerResponse
}

type getEventsResponse = {
  jsonrpc: "2.0"
  id: 1
  result: {
    events: SorobanRpc.EventResponse[],
    latestLedger: string
  }
}

type rpcError = {
  jsonrpc: "2.0"
  id: 1
  error: {
    code: number
    message: string
  }
}

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
    // TODO 
    // support batched inserts
      // https://developers.cloudflare.com/d1/platform/client-api/#dbbatch
    // support dlq as this is our only chance to capture this event
    for (const message of batch.messages) {
      try {
        const { body: event } = message
        await env.EVENTS.prepare(`
          INSERT OR IGNORE INTO "soroban-events" (id, type, ledger, contract_id, topic_1, topic_2, topic_3, topic_4, value)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        `)
          .bind(
            event.id,
            // @ts-ignore
            event.type,
            event.ledger,
            event.contractId,
            event.topic[0] || null,
            event.topic[1] || null,
            event.topic[2] || null,
            event.topic[3] || null,
            event.value.xdr
          )
          .run()
        message.ack()
      } catch(err) {
        message.retry()
        console.error(JSON.stringify(err, null, 2))
      }
    }
  }
}

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

    if(url.pathname.includes('ws')) {
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

async function getLatestLedger() {
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

async function getEvents(cursor: number | string | undefined, limit = 100) {
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

function nextFiveSecondMark(now = new Date()) {
  const currentSeconds = now.getSeconds()
  const remainingSeconds = 5 - (currentSeconds % 5)

  now.setSeconds(now.getSeconds() + remainingSeconds)
  now.setMilliseconds(0)

  return now.getTime()
}