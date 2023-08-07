# Soroban Events Queue

Demo showcasing how to ingest events from the Soroban RPC `getEvents` method into several different queues.

* Websocket
    * [Worker API](https://developers.cloudflare.com/workers/runtime-apis/websockets/use-websockets/)
    * [DO API](https://developers.cloudflare.com/durable-objects/api/hibernatable-websockets-api/)
* [Queue](https://developers.cloudflare.com/queues/) 
    * [KV](https://developers.cloudflare.com/workers/runtime-apis/kv/)
    * [D1](https://developers.cloudflare.com/d1/)
    * [R2](https://developers.cloudflare.com/r2/)

Cloudflare is an incredible stack and there's lots of flexibility here for how to process Soroban events. I've included a bunch of different examples here to show how to get started.

## Running Locally
```bash
npm i
npm run start
```

This will very probably fail until:
1. You've setup a Cloudflare account and run `wrangler login`
2. If you're still running into issues with `npm run start` feel free to file an issue and I'll try to improve this README with further instructions.

## Running in Production
```
npm run deploy
```

This will definitely fail until:
1. You've created all the necessary resources in your Cloudflare account. As per the `wrangler.toml` right now this will include:
    1. A `kv_namespaces` namespace
    2. A `d1_databases` database
    3. Two `queues`
        * A main queue
        * A dead letter queue
    4. A `durable_objects` binding
    5. A `r2_buckets` bucket
2. Once you've got all of these services created and updated in the `wrangler.toml` file feel free to run `npm run deploy` again.
