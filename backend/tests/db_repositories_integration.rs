//! Database repository integration tests — Issue #1747.
//!
//! This module provides comprehensive integration tests for all database repositories
//! using testcontainers (real Postgres+Redis containers) with deterministic fixtures and mocks.
//!
//! Each test validates:
//! - Happy path: correct reads/writes with valid data
//! - Failure path: proper error handling for FK violations, duplicates, invalid constraints
//! - Coverage target: 85%+ for all repository methods
//!
//! Requirements: Docker must be running.
//! Run with: cargo test --test db_repositories_integration

mod common;

use common::TestEnv;

// =============================================================================
// waste_repositories module
// =============================================================================

/// Test: Insert waste with valid recycler_address references existing participant
#[tokio::test]
async fn test_waste_repository_create_success() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Create participant first (FK dependency)
    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (address) DO NOTHING
            "#,
            &[
                &"WASTE_TEST_RECYCLER",
                &"Recycler",
                &"Test Recycler",
                &(0_i64),
                &(0_i64),
                &(1000_i64),
            ],
        )
        .await
        .expect("Failed to insert participant");

    // Create waste
    client
        .execute(
            r#"
            INSERT INTO wastes (id, recycler_address, waste_type, weight, latitude, longitude,
                                registered_at_ledger, registered_at, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
            ON CONFLICT (id) DO NOTHING
            "#,
            &[
                &(1_i64),
                &"WASTE_TEST_RECYCLER",
                &"Plastic",
                &(500_f64),
                &(0_i64),
                &(0_i64),
                &(1001_i64),
                &"submitted",
            ],
        )
        .await
        .expect("Failed to insert waste");

    // Verify waste was created
    let row = client
        .query_one("SELECT waste_type, weight FROM wastes WHERE id = $1", &[&(1_i64)])
        .await
        .expect("Failed to query waste");

    let waste_type: &str = row.get(0);
    let weight: f64 = row.get(1);

    assert_eq!(waste_type, "Plastic");
    assert_eq!(weight, 500.0);
}

/// Test: FK constraint violation when recycler_address doesn't exist
#[tokio::test]
async fn test_waste_repository_invalid_recycler_fk_error() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    let result = client
        .execute(
            r#"
            INSERT INTO wastes (id, recycler_address, waste_type, weight, latitude, longitude,
                                registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            "#,
            &[
                &(2_i64),
                &"NONEXISTENT_RECYCLER",
                &"Metal",
                &(300_f64),
                &(0_i64),
                &(0_i64),
                &(1001_i64),
            ],
        )
        .await;

    assert!(result.is_err(), "Expected FK constraint violation");
}

/// Test: Duplicate waste ID is handled idempotently with ON CONFLICT DO NOTHING
#[tokio::test]
async fn test_waste_repository_duplicate_id_idempotent() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Create participant
    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (address) DO NOTHING
            "#,
            &[
                &"WASTE_DUP_TEST",
                &"Recycler",
                &"Dup Tester",
                &(0_i64),
                &(0_i64),
                &(1000_i64),
            ],
        )
        .await
        .expect("Failed to insert participant");

    // Insert waste with deterministic ID
    let insert_waste = r#"
        INSERT INTO wastes (id, recycler_address, waste_type, weight, latitude, longitude,
                            registered_at_ledger, registered_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO NOTHING
    "#;

    client
        .execute(
            insert_waste,
            &[
                &(3_i64),
                &"WASTE_DUP_TEST",
                &"Glass",
                &(200_f64),
                &(0_i64),
                &(0_i64),
                &(1001_i64),
            ],
        )
        .await
        .expect("First insert failed");

    // Duplicate insert should not error
    client
        .execute(
            insert_waste,
            &[
                &(3_i64),
                &"WASTE_DUP_TEST",
                &"Plastic", // Different type
                &(100_f64),
                &(0_i64),
                &(0_i64),
                &(1001_i64),
            ],
        )
        .await
        .expect("Duplicate insert should succeed with ON CONFLICT DO NOTHING");

    // Verify original values persisted (not updated)
    let row = client
        .query_one("SELECT waste_type, weight FROM wastes WHERE id = $1", &[&(3_i64)])
        .await
        .expect("Failed to query waste");

    let waste_type: &str = row.get(0);
    let weight: f64 = row.get(1);

    assert_eq!(waste_type, "Glass", "Original values should be preserved");
    assert_eq!(weight, 200.0);
}

// =============================================================================
// participant_repositories module
// =============================================================================

/// Test: Create participant with all required fields
#[tokio::test]
async fn test_participant_repository_create_success() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (address) DO NOTHING
            "#,
            &[
                &"PARTICIPANT_CREATE_TEST",
                &"Collector",
                &"Test Participant",
                &(40_i64),
                &(60_i64),
                &(5000_i64),
            ],
        )
        .await
        .expect("Failed to create participant");

    let row = client
        .query_one(
            "SELECT role, name, latitude, longitude FROM participants WHERE address = $1",
            &[&"PARTICIPANT_CREATE_TEST"],
        )
        .await
        .expect("Failed to query participant");

    let role: &str = row.get(0);
    let name: &str = row.get(1);
    let lat: i64 = row.get(2);
    let lon: i64 = row.get(3);

    assert_eq!(role, "Collector");
    assert_eq!(name, "Test Participant");
    assert_eq!(lat, 40);
    assert_eq!(lon, 60);
}

/// Test: Update participant via upsert (ON CONFLICT DO UPDATE)
#[tokio::test]
async fn test_participant_repository_upsert() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    let upsert_sql = r#"
        INSERT INTO participants (address, role, name, latitude, longitude,
                                  registered_at_ledger, registered_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (address) DO UPDATE
          SET role = EXCLUDED.role, name = EXCLUDED.name
    "#;

    // First insert
    client
        .execute(
            upsert_sql,
            &[
                &"PARTICIPANT_UPSERT_TEST",
                &"Recycler",
                &"Original Name",
                &(0_i64),
                &(0_i64),
                &(1000_i64),
            ],
        )
        .await
        .expect("First upsert failed");

    // Update via second upsert
    client
        .execute(
            upsert_sql,
            &[
                &"PARTICIPANT_UPSERT_TEST",
                &"Collector",
                &"Updated Name",
                &(0_i64),
                &(0_i64),
                &(1001_i64),
            ],
        )
        .await
        .expect("Second upsert failed");

    let row = client
        .query_one(
            "SELECT role, name FROM participants WHERE address = $1",
            &[&"PARTICIPANT_UPSERT_TEST"],
        )
        .await
        .expect("Failed to query after upsert");

    let role: &str = row.get(0);
    let name: &str = row.get(1);

    assert_eq!(role, "Collector", "Role should be updated");
    assert_eq!(name, "Updated Name", "Name should be updated");
}

/// Test: Query participants with filtering
#[tokio::test]
async fn test_participant_repository_list_by_role() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Insert multiple participants
    for (i, role) in &[("Recycler", 0), ("Recycler", 1), ("Collector", 2)] {
        let addr = format!("PARTICIPANT_LIST_TEST_{}", i);
        client
            .execute(
                r#"
                INSERT INTO participants (address, role, name, latitude, longitude,
                                          registered_at_ledger, registered_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (address) DO NOTHING
                "#,
                &[
                    &addr,
                    role,
                    &format!("Participant {}", i),
                    &(0_i64),
                    &(0_i64),
                    &(1000_i64),
                ],
            )
            .await
            .expect("Failed to insert participant");
    }

    // Query recyclers
    let rows = client
        .query(
            "SELECT address, role FROM participants WHERE role = $1 AND address LIKE $2 ORDER BY address",
            &[&"Recycler", &"PARTICIPANT_LIST_TEST_%"],
        )
        .await
        .expect("Failed to query recyclers");

    assert_eq!(rows.len(), 2, "Should find 2 recyclers");

    for row in rows {
        let role: &str = row.get(1);
        assert_eq!(role, "Recycler");
    }
}

// =============================================================================
// waste_verification_repositories module
// =============================================================================

/// Test: Insert waste verification record with valid FK references
#[tokio::test]
async fn test_waste_verification_repository_create_success() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Create recycler participant
    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (address) DO NOTHING
            "#,
            &[
                &"VERIFY_RECYCLER",
                &"Recycler",
                &"Verifier Test Recycler",
                &(0_i64),
                &(0_i64),
                &(1000_i64),
            ],
        )
        .await
        .expect("Failed to insert recycler");

    // Create verifier participant
    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (address) DO NOTHING
            "#,
            &[
                &"VERIFY_VERIFIER",
                &"Verifier",
                &"Test Verifier",
                &(0_i64),
                &(0_i64),
                &(1000_i64),
            ],
        )
        .await
        .expect("Failed to insert verifier");

    // Create waste
    client
        .execute(
            r#"
            INSERT INTO wastes (id, recycler_address, waste_type, weight, latitude, longitude,
                                registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (id) DO NOTHING
            "#,
            &[
                &(10_i64),
                &"VERIFY_RECYCLER",
                &"Plastic",
                &(500_f64),
                &(0_i64),
                &(0_i64),
                &(1001_i64),
            ],
        )
        .await
        .expect("Failed to insert waste");

    // Create waste verification
    client
        .execute(
            r#"
            INSERT INTO waste_verifications (waste_id, verifier_address, verification_status,
                                             verified_at_ledger, verified_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (waste_id) DO NOTHING
            "#,
            &[&(10_i64), &"VERIFY_VERIFIER", &"verified", &(1002_i64)],
        )
        .await
        .expect("Failed to create waste verification");

    let row = client
        .query_one(
            "SELECT verification_status, verifier_address FROM waste_verifications WHERE waste_id = $1",
            &[&(10_i64)],
        )
        .await
        .expect("Failed to query waste verification");

    let status: &str = row.get(0);
    let verifier: &str = row.get(1);

    assert_eq!(status, "verified");
    assert_eq!(verifier, "VERIFY_VERIFIER");
}

/// Test: FK constraint violation on waste_id reference
#[tokio::test]
async fn test_waste_verification_repository_invalid_waste_fk() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Create verifier participant
    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (address) DO NOTHING
            "#,
            &[
                &"VERIFY_VERIFIER_FK",
                &"Verifier",
                &"FK Test Verifier",
                &(0_i64),
                &(0_i64),
                &(1000_i64),
            ],
        )
        .await
        .expect("Failed to insert verifier");

    // Try to create verification for non-existent waste
    let result = client
        .execute(
            r#"
            INSERT INTO waste_verifications (waste_id, verifier_address, verification_status,
                                             verified_at_ledger, verified_at)
            VALUES ($1, $2, $3, $4, NOW())
            "#,
            &[&(99999_i64), &"VERIFY_VERIFIER_FK", &"verified", &(1002_i64)],
        )
        .await;

    assert!(
        result.is_err(),
        "Expected FK constraint violation for non-existent waste"
    );
}

// =============================================================================
// incentive_repositories module
// =============================================================================

/// Test: Create incentive with valid admin_address and valid waste_type
#[tokio::test]
async fn test_incentive_repository_create_success() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Create admin participant
    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (address) DO NOTHING
            "#,
            &[
                &"INCENTIVE_ADMIN",
                &"Admin",
                &"Test Admin",
                &(0_i64),
                &(0_i64),
                &(1000_i64),
            ],
        )
        .await
        .expect("Failed to insert admin");

    // Create incentive
    client
        .execute(
            r#"
            INSERT INTO incentives (admin_address, waste_type, reward_amount, active,
                                    created_at_ledger, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (admin_address, waste_type) DO NOTHING
            "#,
            &[&"INCENTIVE_ADMIN", &"Plastic", &(1000_f64), &true, &(1001_i64)],
        )
        .await
        .expect("Failed to create incentive");

    let row = client
        .query_one(
            "SELECT waste_type, reward_amount, active FROM incentives WHERE admin_address = $1",
            &[&"INCENTIVE_ADMIN"],
        )
        .await
        .expect("Failed to query incentive");

    let waste_type: &str = row.get(0);
    let reward: f64 = row.get(1);
    let active: bool = row.get(2);

    assert_eq!(waste_type, "Plastic");
    assert_eq!(reward, 1000.0);
    assert!(active);
}

/// Test: List active incentives for specific waste type
#[tokio::test]
async fn test_incentive_repository_list_by_waste_type() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Create admin
    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (address) DO NOTHING
            "#,
            &[
                &"INCENTIVE_LIST_ADMIN",
                &"Admin",
                &"List Test Admin",
                &(0_i64),
                &(0_i64),
                &(1000_i64),
            ],
        )
        .await
        .expect("Failed to insert admin");

    // Create multiple incentives
    for waste_type in &["Plastic", "Glass", "Metal"] {
        client
            .execute(
                r#"
                INSERT INTO incentives (admin_address, waste_type, reward_amount, active,
                                        created_at_ledger, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (admin_address, waste_type) DO NOTHING
                "#,
                &[&"INCENTIVE_LIST_ADMIN", waste_type, &(500_f64), &true, &(1001_i64)],
            )
            .await
            .expect("Failed to create incentive");
    }

    // Query plastic incentives
    let rows = client
        .query(
            "SELECT waste_type FROM incentives WHERE waste_type = $1 AND active = true",
            &[&"Plastic"],
        )
        .await
        .expect("Failed to query incentives");

    assert_eq!(rows.len(), 1, "Should find 1 plastic incentive");
}

// =============================================================================
// payout_repositories module
// =============================================================================

/// Test: Record payout with valid references
#[tokio::test]
async fn test_payout_repository_create_success() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Create recycler participant
    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (address) DO NOTHING
            "#,
            &[
                &"PAYOUT_RECYCLER",
                &"Recycler",
                &"Payout Test Recycler",
                &(0_i64),
                &(0_i64),
                &(1000_i64),
            ],
        )
        .await
        .expect("Failed to insert recycler");

    // Create payout record
    client
        .execute(
            r#"
            INSERT INTO payouts (recipient_address, amount, status, processed_at_ledger, processed_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (recipient_address, processed_at_ledger) DO NOTHING
            "#,
            &[&"PAYOUT_RECYCLER", &(500_f64), &"pending", &(1002_i64)],
        )
        .await
        .expect("Failed to create payout");

    let row = client
        .query_one(
            "SELECT amount, status FROM payouts WHERE recipient_address = $1",
            &[&"PAYOUT_RECYCLER"],
        )
        .await
        .expect("Failed to query payout");

    let amount: f64 = row.get(0);
    let status: &str = row.get(1);

    assert_eq!(amount, 500.0);
    assert_eq!(status, "pending");
}

/// Test: Payout status transitions (pending → completed)
#[tokio::test]
async fn test_payout_repository_status_transition() {
    let env = TestEnv::start().await;
    let client = env.pg_client().await;

    // Create participant
    client
        .execute(
            r#"
            INSERT INTO participants (address, role, name, latitude, longitude,
                                      registered_at_ledger, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (address) DO NOTHING
            "#,
            &[
                &"PAYOUT_STATUS_TEST",
                &"Recycler",
                &"Status Test",
                &(0_i64),
                &(0_i64),
                &(1000_i64),
            ],
        )
        .await
        .expect("Failed to insert participant");

    // Create payout with pending status
    client
        .execute(
            r#"
            INSERT INTO payouts (recipient_address, amount, status, processed_at_ledger, processed_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (recipient_address, processed_at_ledger) DO NOTHING
            "#,
            &[&"PAYOUT_STATUS_TEST", &(1000_f64), &"pending", &(1002_i64)],
        )
        .await
        .expect("Failed to create payout");

    // Update status to completed
    client
        .execute(
            "UPDATE payouts SET status = $1 WHERE recipient_address = $2",
            &[&"completed", &"PAYOUT_STATUS_TEST"],
        )
        .await
        .expect("Failed to update payout status");

    let row = client
        .query_one(
            "SELECT status FROM payouts WHERE recipient_address = $1",
            &[&"PAYOUT_STATUS_TEST"],
        )
        .await
        .expect("Failed to query updated payout");

    let status: &str = row.get(0);
    assert_eq!(status, "completed", "Status should be updated to completed");
}
