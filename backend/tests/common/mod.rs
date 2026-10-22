//! Shared testcontainers fixture for backend integration tests — Issue #1530.
//!
//! # Usage
//!
//! ```rust
//! mod common;
//! use common::TestEnv;
//!
//! #[tokio::test]
//! async fn my_test() {
//!     let env = TestEnv::start().await;
//!     // env.pg_url()   — postgres connection string
//!     // env.redis_url() — redis URL
//!     // env.pg_client() — tokio-postgres Client with schema applied
//! }
//! ```
//!
//! The containers are dropped (and stopped) when `TestEnv` goes out of scope.
//! Re-use the same `TestEnv` within a single test binary to avoid redundant
//! container starts — each test that needs isolation should use a fresh schema
//! prefix or wrap its mutations in a transaction that it rolls back.

use std::sync::Arc;
use testcontainers::{ContainerAsync, ImageExt};
use testcontainers_modules::{postgres::Postgres, redis::Redis};
use tokio_postgres::{Client, NoTls};

// ---------------------------------------------------------------------------
// Public environment handle
// ---------------------------------------------------------------------------

/// A running Postgres + Redis pair, started by `testcontainers`.
///
/// Kept alive until dropped.  Reusable across multiple tests within the same
/// test binary by sharing an `Arc<TestEnv>` via `once_cell::sync::OnceCell`
/// or by calling `TestEnv::start()` once in a `#[tokio::test]` setup fixture.
pub struct TestEnv {
    // Containers must be kept alive; dropping them stops the Docker container.
    _pg_container: ContainerAsync<Postgres>,
    _redis_container: ContainerAsync<Redis>,
    pg_url: String,
    redis_url: String,
}

impl TestEnv {
    /// Start fresh Postgres and Redis containers and apply the indexer schema.
    ///
    /// The returned value keeps the containers alive for the duration of the
    /// test.  Call this once per test (or share an `Arc` if the schema is
    /// sufficient for multiple tests).
    pub async fn start() -> Self {
        let pg_container = testcontainers::runners::AsyncRunner::run(
            Postgres::default()
                .with_env_var("POSTGRES_USER", "test")
                .with_env_var("POSTGRES_PASSWORD", "test")
                .with_env_var("POSTGRES_DB", "scavenger_test"),
        )
        .await
        .expect("failed to start Postgres container");

        let redis_container = testcontainers::runners::AsyncRunner::run(Redis::default())
            .await
            .expect("failed to start Redis container");

        let pg_host = pg_container.get_host().await.expect("pg host");
        let pg_port = pg_container
            .get_host_port_ipv4(5432)
            .await
            .expect("pg port");
        let pg_url = format!(
            "host={pg_host} port={pg_port} user=test password=test dbname=scavenger_test"
        );

        let redis_host = redis_container.get_host().await.expect("redis host");
        let redis_port = redis_container
            .get_host_port_ipv4(6379)
            .await
            .expect("redis port");
        let redis_url = format!("redis://{redis_host}:{redis_port}");

        let env = Self {
            _pg_container: pg_container,
            _redis_container: redis_container,
            pg_url,
            redis_url,
        };

        // Apply base schema so every test starts with tables in place.
        env.apply_schema().await;

        env
    }

    /// Postgres connection string (DSN format, compatible with `tokio-postgres`).
    pub fn pg_url(&self) -> &str {
        &self.pg_url
    }

    /// Redis URL.
    pub fn redis_url(&self) -> &str {
        &self.redis_url
    }

    /// Open a fresh `tokio-postgres` client connected to the test database.
    pub async fn pg_client(&self) -> Client {
        let (client, connection) = tokio_postgres::connect(&self.pg_url, NoTls)
            .await
            .expect("failed to connect to test Postgres");

        // Drive the connection in a background task.
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("[TestEnv] Postgres connection error: {e}");
            }
        });

        client
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /// Apply the minimal schema required by the integration tests.
    ///
    /// This mirrors the first migration in `indexer/src/db/migrations/` so the
    /// tests exercise the same tables that production code writes to.
    async fn apply_schema(&self) {
        let client = self.pg_client().await;

        client
            .batch_execute(SCHEMA_SQL)
            .await
            .expect("failed to apply test schema");
    }
}

// ---------------------------------------------------------------------------
// Embedded schema (mirrors 001_initial_schema_up.sql)
// ---------------------------------------------------------------------------

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS sync_status (
    id          SERIAL PRIMARY KEY,
    last_ledger BIGINT NOT NULL DEFAULT 0,
    last_ledger_close_time TIMESTAMPTZ,
    is_syncing  BOOLEAN NOT NULL DEFAULT false,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sync_status (last_ledger) VALUES (0) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS raw_events (
    id               BIGSERIAL PRIMARY KEY,
    ledger_sequence  BIGINT NOT NULL,
    ledger_close_time TIMESTAMPTZ NOT NULL,
    transaction_hash TEXT NOT NULL,
    contract_id      TEXT NOT NULL,
    event_type       TEXT NOT NULL,
    topic            TEXT[] NOT NULL,
    value            JSONB NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_events_tx_type
    ON raw_events(transaction_hash, event_type, (topic[1]));

CREATE TABLE IF NOT EXISTS participants (
    address              TEXT PRIMARY KEY,
    role                 TEXT NOT NULL,
    name                 TEXT NOT NULL,
    latitude             BIGINT NOT NULL,
    longitude            BIGINT NOT NULL,
    registered_at_ledger BIGINT NOT NULL,
    registered_at        TIMESTAMPTZ NOT NULL,
    is_active            BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS wastes (
    id                   BIGINT PRIMARY KEY,
    recycler_address     TEXT NOT NULL REFERENCES participants(address),
    waste_type           TEXT NOT NULL,
    weight               NUMERIC NOT NULL,
    latitude             BIGINT NOT NULL,
    longitude            BIGINT NOT NULL,
    is_confirmed         BOOLEAN NOT NULL DEFAULT false,
    is_active            BOOLEAN NOT NULL DEFAULT true,
    grade                TEXT,
    processing_status    INT,
    contamination_level  INT,
    registered_at_ledger BIGINT NOT NULL,
    registered_at        TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS waste_transfers (
    id              BIGSERIAL PRIMARY KEY,
    waste_id        BIGINT NOT NULL,
    from_address    TEXT NOT NULL,
    to_address      TEXT NOT NULL,
    ledger_sequence BIGINT NOT NULL,
    transferred_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS token_rewards (
    id                BIGSERIAL PRIMARY KEY,
    recipient_address TEXT NOT NULL,
    amount            NUMERIC NOT NULL,
    waste_id          BIGINT NOT NULL,
    ledger_sequence   BIGINT NOT NULL,
    rewarded_at       TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS carbon_credits (
    id                BIGSERIAL PRIMARY KEY,
    participant_address TEXT NOT NULL,
    waste_type        TEXT NOT NULL,
    weight            NUMERIC NOT NULL,
    credits           NUMERIC NOT NULL,
    ledger_sequence   BIGINT NOT NULL,
    earned_at         TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS auctions (
    id                BIGINT PRIMARY KEY,
    waste_id          BIGINT NOT NULL,
    creator_address   TEXT NOT NULL,
    start_price       NUMERIC NOT NULL,
    end_time          NUMERIC NOT NULL,
    is_ended          BOOLEAN NOT NULL DEFAULT false,
    winner_address    TEXT,
    final_price       NUMERIC,
    created_at_ledger BIGINT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL
);
"#;
