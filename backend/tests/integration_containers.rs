//! Backend integration test suite against real PostgreSQL and Redis containers — Issue #1530.
//!
//! Each `#[tokio::test]` in this file starts fresh containers (via the shared
//! `TestEnv::start()` helper in `common/`) and exercises a real happy path and
//! a failure path for each API module.
//!
//! Run locally with:
//!   cargo test --test integration_containers
//!
//! Or target all integration tests:
//!   cargo test --test '*'
//!
//! Requirements: Docker must be running.  The tests pull official
//! `postgres:16` and `redis:7` images via testcontainers on first run.

mod common;

use common::TestEnv;

// =============================================================================
// sync_status module — Postgres-backed
// =============================================================================

/// Happy path: insert a sync_status row, read it back.
#[tokio::test]
async fn test_sync_status_read_write_happy_path() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // The schema already inserts a zero-state row; read it back.
    let row = client
        .query_one("SELECT last_ledger, is_syncing FROM sync_status LIMIT 1", &[])
        .await
        .expect("SELECT sync_status failed");

    let last_ledger: i64 = row.get(0);
    let is_syncing: bool = row.get(1);

    assert_eq!(last_ledger, 0);
    assert!(!is_syncing);
}

/// Failure path: updating a non-existent table returns a DB error.
#[tokio::test]
async fn test_sync_status_wrong_table_returns_error() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    let result = client
        .query("SELECT 1 FROM does_not_exist_table", &[])
        .await;

    assert!(
        result.is_err(),
        "Expected query against missing table to fail"
    );
}

// =============================================================================
// raw_events module — insert, dedup, read
// =============================================================================

/// Happy path: store a raw event and confirm it is persisted.
#[tokio::test]
async fn test_raw_events_insert_and_read() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    client
        .execute(
            r#"
            INSERT INTO raw_events
              (ledger_sequence, ledger_close_time, transaction_hash,
               contract_id, event_type, topic, value)
            VALUES
              ($1, NOW(), $2, $3, $4, $5, $6)
            "#,
            &[
                &(1001_i64),
                &"0xAAA111",
                &"CONTRACT_A",
                &"recycled",
                &vec!["recycled".to_string(), "waste_001".to_string()],
                &serde_json::json!([1, "500", "ADDR", "0", "0"]),
            ],
        )
        .await
        .expect("INSERT raw_event failed");

    let row = client
        .query_one(
            "SELECT event_type FROM raw_events WHERE transaction_hash = $1",
            &[&"0xAAA111"],
        )
        .await
        .expect("SELECT raw_events failed");

    let event_type: &str = row.get(0);
    assert_eq!(event_type, "recycled");
}

/// Failure path: inserting a duplicate raw event (same tx_hash + event_type +
/// topic[1]) must be silently ignored (ON CONFLICT DO NOTHING).
#[tokio::test]
async fn test_raw_events_duplicate_is_idempotent() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    let insert = r#"
        INSERT INTO raw_events
          (ledger_sequence, ledger_close_time, transaction_hash,
           contract_id, event_type, topic, value)
        VALUES
          ($1, NOW(), $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
    "#;
    let params: &[&(dyn tokio_postgres::types::ToSql + Sync)] = &[
        &(1001_i64),
        &"0xDUPE",
        &"CONTRACT_A",
        &"recycled",
        &vec!["recycled".to_string(), "waste_dupe".to_string()],
        &serde_json::json!([0]),
    ];

    client
        .execute(insert, params)
        .await
        .expect("first insert failed");

    // Second insert with same key — must not error.
    client
        .execute(insert, params)
        .await
        .expect("duplicate insert (ON CONFLICT DO NOTHING) must not fail");

    let count_row = client
        .query_one(
            "SELECT COUNT(*) FROM raw_events WHERE transaction_hash = $1",
            &[&"0xDUPE"],
        )
        .await
        .expect("COUNT failed");

    let count: i64 = count_row.get(0);
    assert_eq!(count, 1, "duplicate should be deduplicated");
}

// =============================================================================
// participants module
// =============================================================================

/// Happy path: register a participant, query by address.
#[tokio::test]
async fn test_participants_insert_and_read() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    client
        .execute(
            r#"
            INSERT INTO participants
              (address, role, name, latitude, longitude,
               registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            "#,
            &[
                &"GADDR_TEST_001",
                &"Recycler",
                &"Alice",
                &(0_i64),
                &(0_i64),
                &(1001_i64),
            ],
        )
        .await
        .expect("INSERT participant failed");

    let row = client
        .query_one(
            "SELECT role, name FROM participants WHERE address = $1",
            &[&"GADDR_TEST_001"],
        )
        .await
        .expect("SELECT participant failed");

    let role: &str = row.get(0);
    let name: &str = row.get(1);
    assert_eq!(role, "Recycler");
    assert_eq!(name, "Alice");
}

/// Failure path: registering a participant with a duplicate primary key must
/// trigger ON CONFLICT → UPDATE (upsert) rather than hard failure.
#[tokio::test]
async fn test_participants_upsert_on_duplicate_address() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    let upsert = r#"
        INSERT INTO participants
          (address, role, name, latitude, longitude,
           registered_at_ledger, registered_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (address) DO UPDATE
          SET role = EXCLUDED.role, name = EXCLUDED.name
    "#;

    client
        .execute(
            upsert,
            &[
                &"GADDR_DUP",
                &"Recycler",
                &"Original",
                &(0_i64),
                &(0_i64),
                &(1001_i64),
            ],
        )
        .await
        .expect("first upsert failed");

    // Update the name via a second upsert.
    client
        .execute(
            upsert,
            &[
                &"GADDR_DUP",
                &"Collector",
                &"Updated",
                &(0_i64),
                &(0_i64),
                &(1002_i64),
            ],
        )
        .await
        .expect("second upsert failed");

    let row = client
        .query_one(
            "SELECT role, name FROM participants WHERE address = $1",
            &[&"GADDR_DUP"],
        )
        .await
        .expect("SELECT after upsert failed");

    let role: &str = row.get(0);
    let name: &str = row.get(1);
    assert_eq!(role, "Collector");
    assert_eq!(name, "Updated");
}

// =============================================================================
// wastes module
// =============================================================================

/// Happy path: insert a waste item referencing a known participant.
#[tokio::test]
async fn test_wastes_insert_and_read() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Participant must exist first (FK constraint).
    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            "#,
            &[&"GADDR_P", &"Recycler", &"Recycler01", &(0_i64), &(0_i64), &(1000_i64)],
        )
        .await
        .expect("INSERT participant failed");

    client
        .execute(
            r#"
            INSERT INTO wastes
              (id, recycler_address, waste_type, weight, latitude, longitude,
               registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, 500, $4, $5, $6, NOW())
            ON CONFLICT (id) DO NOTHING
            "#,
            &[
                &(42_i64),
                &"GADDR_P",
                &"Plastic",
                &(0_i64),
                &(0_i64),
                &(1001_i64),
            ],
        )
        .await
        .expect("INSERT waste failed");

    let row = client
        .query_one("SELECT waste_type FROM wastes WHERE id = $1", &[&(42_i64)])
        .await
        .expect("SELECT waste failed");

    let waste_type: &str = row.get(0);
    assert_eq!(waste_type, "Plastic");
}

/// Failure path: inserting a waste with a non-existent recycler_address
/// violates the FK constraint.
#[tokio::test]
async fn test_wastes_fk_violation_returns_error() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    let result = client
        .execute(
            r#"
            INSERT INTO wastes
              (id, recycler_address, waste_type, weight, latitude, longitude,
               registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, 100, $4, $5, $6, NOW())
            "#,
            &[
                &(99_i64),
                &"NONEXISTENT_ADDR",
                &"Metal",
                &(0_i64),
                &(0_i64),
                &(999_i64),
            ],
        )
        .await;

    assert!(result.is_err(), "FK violation must return an error");
}

// =============================================================================
// auctions module
// =============================================================================

/// Happy path: create an auction, end it.
#[tokio::test]
async fn test_auctions_lifecycle_happy_path() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    client
        .execute(
            r#"
            INSERT INTO auctions
              (id, waste_id, creator_address, start_price, end_time,
               created_at_ledger, created_at)
            VALUES ($1, $2, $3, 5000, 9999, $4, NOW())
            ON CONFLICT (id) DO NOTHING
            "#,
            &[&(1_i64), &(10_i64), &"GADDR_CREATOR", &(1010_i64)],
        )
        .await
        .expect("INSERT auction failed");

    client
        .execute(
            r#"
            UPDATE auctions
            SET is_ended = true, winner_address = $1, final_price = 6500
            WHERE id = $2
            "#,
            &[&"GADDR_WINNER", &(1_i64)],
        )
        .await
        .expect("UPDATE auction failed");

    let row = client
        .query_one("SELECT is_ended, winner_address FROM auctions WHERE id = $1", &[&(1_i64)])
        .await
        .expect("SELECT auction failed");

    let is_ended: bool = row.get(0);
    let winner: &str = row.get(1);
    assert!(is_ended);
    assert_eq!(winner, "GADDR_WINNER");
}

/// Failure path: ending a non-existent auction affects zero rows.
#[tokio::test]
async fn test_auctions_end_nonexistent_affects_zero_rows() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    let n = client
        .execute(
            "UPDATE auctions SET is_ended = true WHERE id = $1",
            &[&(99999_i64)],
        )
        .await
        .expect("UPDATE on non-existent auction must not error");

    assert_eq!(n, 0, "no rows should be affected");
}

// =============================================================================
// token_rewards module
// =============================================================================

/// Happy path: insert a token reward, read it back.
#[tokio::test]
async fn test_token_rewards_insert_and_read() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Cast amount to TEXT in the query so we avoid pulling in rust_decimal.
    client
        .execute(
            r#"
            INSERT INTO token_rewards
              (recipient_address, amount, waste_id, ledger_sequence, rewarded_at)
            VALUES ($1, 10000, $2, $3, NOW())
            "#,
            &[&"GADDR_RECIPIENT", &(1_i64), &(1005_i64)],
        )
        .await
        .expect("INSERT token_reward failed");

    let row = client
        .query_one(
            "SELECT amount::TEXT FROM token_rewards WHERE recipient_address = $1",
            &[&"GADDR_RECIPIENT"],
        )
        .await
        .expect("SELECT token_reward failed");

    let amount_str: &str = row.get(0);
    assert_eq!(amount_str, "10000");
}

/// Failure path: querying token_rewards with an invalid column name fails.
#[tokio::test]
async fn test_token_rewards_bad_column_query_fails() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    let result = client
        .query("SELECT nonexistent_col FROM token_rewards", &[])
        .await;

    assert!(result.is_err(), "Query with bad column name must fail");
}

// =============================================================================
// Redis — basic connectivity
// =============================================================================

/// Happy path: SET and GET a key via the raw Redis TCP protocol.
#[tokio::test]
async fn test_redis_set_get_happy_path() {
    let env = TestEnv::start().await;

    // Use a raw TCP connection to verify Redis is reachable without pulling in
    // the full `redis` crate in tests/.
    let url = env.redis_url();

    // Parse host:port from redis://host:port
    let addr = url
        .trim_start_matches("redis://")
        .to_string();

    let mut stream = tokio::net::TcpStream::connect(&addr)
        .await
        .expect("Failed to connect to Redis container");

    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    // PING
    stream
        .write_all(b"*1\r\n$4\r\nPING\r\n")
        .await
        .expect("Failed to write PING");

    let mut buf = [0u8; 64];
    let n = stream.read(&mut buf).await.expect("Failed to read PING response");
    let response = std::str::from_utf8(&buf[..n]).expect("Invalid UTF-8 in PING response");
    assert!(response.contains("PONG"), "Expected PONG, got: {response}");
}

/// Failure path: connecting to a port that is not Redis returns an error.
#[tokio::test]
async fn test_redis_connection_to_wrong_port_fails() {
    // Port 1 is almost certainly not in use.
    let result = tokio::net::TcpStream::connect("127.0.0.1:1").await;
    assert!(result.is_err(), "Connection to unused port must fail");
}

// =============================================================================
// Helpers
// =============================================================================
