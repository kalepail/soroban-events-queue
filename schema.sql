DROP TABLE IF EXISTS "soroban-events";
CREATE TABLE IF NOT EXISTS "soroban-events" (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    ledger INTEGER NOT NULL,
    contract_id TEXT NOT NULL,
    topic_1 TEXT,
    topic_2 TEXT,
    topic_3 TEXT,
    topic_4 TEXT,
    value TEXT NOT NULL
);