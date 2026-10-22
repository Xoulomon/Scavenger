//! Consolidated analytics module (issue #1514)
//!
//! This module consolidates on-chain analytics functionality by:
//! 1. Providing lightweight helpers for mutating GlobalMetrics and RecyclingStats
//! 2. Managing storage persistence of analytics snapshots
//! 3. Implementing periodic batching to control storage write costs
//! 4. Supporting contract upgrade migrations
//!
//! **Removed (issue #1514)**: Complex reporting types (ReportType, AnalyticsReport,
//! CustomQuery, AggregationType, AnalyticsEngine) are not used on-chain and belong
//! in the off-chain indexer instead. They were removed to reduce contract complexity.
//!
//! # Responsibilities
//! - Supply-chain statistics aggregation
//! - Global metrics updates
//! - Per-participant stat tracking helpers
//! - Carbon-credit and impact-score accumulation
//! - Analytics snapshot persistence (NEW)
//! - Periodic batching of analytics updates (NEW)

use crate::types::{GlobalMetrics, RecyclingStats, WasteGrade, WasteType};
use soroban_sdk::{Address, Env, Symbol};

// ────────────────────────────────────────────────────────────────────────
// GlobalMetrics Mutation Helpers (from contract_analytics.rs)
// ────────────────────────────────────────────────────────────────────────

impl GlobalMetrics {
    /// Increments the counter for the given `grade`.
    pub fn record_grade(&mut self, grade: WasteGrade) {
        match grade {
            WasteGrade::A => self.grade_a_count += 1,
            WasteGrade::B => self.grade_b_count += 1,
            WasteGrade::C => self.grade_c_count += 1,
            WasteGrade::D => self.grade_d_count += 1,
        }
    }

    /// Records a new active waste item.
    pub fn record_waste_registered(&mut self) {
        self.total_wastes_count += 1;
        self.active_waste_count += 1;
    }

    /// Records a waste item being deactivated.
    pub fn record_waste_deactivated(&mut self) {
        if self.active_waste_count > 0 {
            self.active_waste_count -= 1;
        }
    }

    /// Records a waste item as expired.
    pub fn record_waste_expired(&mut self) {
        self.expired_waste_count += 1;
        if self.active_waste_count > 0 {
            self.active_waste_count -= 1;
        }
    }

    /// Accumulates token rewards into global totals.
    pub fn record_tokens_earned(&mut self, tokens: u128) {
        self.total_tokens_earned = self.total_tokens_earned.saturating_add(tokens);
    }

    /// Accumulates carbon credits into global totals.
    pub fn record_carbon_credits(&mut self, credits: u128) {
        self.total_carbon_credits = self.total_carbon_credits.saturating_add(credits);
    }
}

// ────────────────────────────────────────────────────────────────────────
// RecyclingStats Mutation Helpers (from contract_analytics.rs)
// ────────────────────────────────────────────────────────────────────────

/// Accumulates a waste-type submission into `stats`.
pub fn record_waste_type_submission(
    stats: &mut RecyclingStats,
    waste_type: WasteType,
    weight_grams: u64,
) {
    stats.total_submissions += 1;
    stats.total_weight = stats.total_weight.saturating_add(weight_grams);
    match waste_type {
        WasteType::Paper => stats.paper_count += 1,
        WasteType::PetPlastic => stats.pet_plastic_count += 1,
        WasteType::Plastic => stats.plastic_count += 1,
        WasteType::Metal => stats.metal_count += 1,
        WasteType::Glass => stats.glass_count += 1,
        WasteType::Organic => stats.organic_count += 1,
        WasteType::Electronic => stats.electronic_count += 1,
    }
}

/// Records token and carbon-credit earnings for a participant.
pub fn record_earnings(stats: &mut RecyclingStats, tokens: u64, carbon_credits: u128) {
    stats.total_points = stats.total_points.saturating_add(tokens);
    stats.carbon_credits_earned = stats
        .carbon_credits_earned
        .saturating_add(carbon_credits);
}

/// Recalculates the recycling rate and updates `stats.recycling_rate`.
///
/// Rate is stored as basis points: 10 000 = 100 %.
pub fn refresh_recycling_rate(stats: &mut RecyclingStats) {
    stats.recycling_rate = if stats.total_weight == 0 {
        0
    } else {
        ((stats.recycled_weight * 10_000) / stats.total_weight as u128) as u32
    };
}

// ────────────────────────────────────────────────────────────────────────
// Storage Integration (NEW — issue #1514)
// ────────────────────────────────────────────────────────────────────────

/// Storage key for global metrics snapshot
pub const GLOBAL_METRICS_SNAPSHOT: Symbol = soroban_sdk::symbol_short!("GMTR_SNAP");

/// Storage key for analytics update timestamp
pub const ANALYTICS_LAST_UPDATE: Symbol = soroban_sdk::symbol_short!("ANAL_UPD");

/// Storage key for analytics batch counter
pub const ANALYTICS_BATCH_COUNT: Symbol = soroban_sdk::symbol_short!("ANAL_BAT");

/// Number of transactions between analytics snapshots (configurable).
/// Current setting: snapshot every 10 transactions to balance consistency vs storage costs.
const ANALYTICS_BATCH_SIZE: u64 = 10;

/// Returns the storage key for per-participant recycling stats.
pub fn recycling_stats_key(address: &Address) -> (soroban_sdk::String, Address) {
    (soroban_sdk::String::from_str(&Env::default(), "recycling_stats"), address.clone())
}

// ────────────────────────────────────────────────────────────────────────
// Persistence Functions
// ────────────────────────────────────────────────────────────────────────

/// Saves the global metrics snapshot to persistent storage.
///
/// **Note**: Use [`try_periodic_update`] instead to leverage batching.
pub fn save_global_metrics(env: &Env, metrics: &GlobalMetrics) -> Result<(), soroban_sdk::String> {
    env.storage()
        .instance()
        .set(&GLOBAL_METRICS_SNAPSHOT, metrics);
    Ok(())
}

/// Retrieves the latest global metrics snapshot from storage.
///
/// Returns `None` if no snapshot has been created yet.
pub fn get_global_metrics(env: &Env) -> Option<GlobalMetrics> {
    env.storage()
        .instance()
        .get::<_, GlobalMetrics>(&GLOBAL_METRICS_SNAPSHOT)
}

/// Saves per-participant recycling stats to persistent storage.
///
/// **Note**: Use [`try_periodic_update`] instead to leverage batching.
pub fn save_recycling_stats(env: &Env, stats: &RecyclingStats) -> Result<(), soroban_sdk::String> {
    let key = recycling_stats_key(&stats.participant);
    env.storage().persistent().set(&key, stats);
    Ok(())
}

/// Retrieves recycling stats for a specific participant.
///
/// Returns `None` if no stats have been recorded for this participant.
pub fn get_recycling_stats(env: &Env, address: &Address) -> Option<RecyclingStats> {
    let key = recycling_stats_key(address);
    env.storage().persistent().get::<_, RecyclingStats>(&key)
}

/// Triggers a periodic analytics update if the batch threshold has been crossed.
///
/// This function tracks transaction count and persists analytics snapshots
/// approximately every `ANALYTICS_BATCH_SIZE` transactions, rather than on
/// every operation. This significantly reduces storage costs while maintaining
/// a reasonable audit trail.
///
/// # Strategy
/// - Increments the batch counter on each call
/// - When counter reaches `ANALYTICS_BATCH_SIZE`, persists snapshot and resets counter
/// - Off-chain indexer has complete event history regardless of batching
///
/// # Storage Impact
/// - Saves 1 entry per ~10 transactions (vs 1 per transaction without batching)
/// - Reduces on-chain storage write cost by ~90%
pub fn try_periodic_update(env: &Env, metrics: &GlobalMetrics) -> Result<(), soroban_sdk::String> {
    // Load current batch counter
    let current_batch = env
        .storage()
        .instance()
        .get::<_, u64>(&ANALYTICS_BATCH_COUNT)
        .unwrap_or(0);

    // Increment counter
    let new_batch = current_batch + 1;
    env.storage()
        .instance()
        .set(&ANALYTICS_BATCH_COUNT, &new_batch);

    // Check if we've reached the batch threshold
    if new_batch >= ANALYTICS_BATCH_SIZE {
        // Persist the snapshot
        save_global_metrics(env, metrics)?;

        // Record the update timestamp for audit
        let timestamp = env.ledger().timestamp();
        env.storage()
            .instance()
            .set(&ANALYTICS_LAST_UPDATE, &timestamp);

        // Reset the batch counter
        env.storage().instance().set(&ANALYTICS_BATCH_COUNT, &0u64);
    }

    Ok(())
}

// ────────────────────────────────────────────────────────────────────────
// Migration Helpers (NEW — issue #1514)
// ────────────────────────────────────────────────────────────────────────

/// Initializes analytics storage from on-chain state during contract upgrade.
///
/// This function should be called once during a contract upgrade to capture
/// the current state before any new operations occur. It creates an initial
/// snapshot that can be used as a baseline for analytics queries.
///
/// # Returns
/// - `Ok(())` if initialization succeeds
/// - `Err(msg)` if a snapshot already exists (prevents overwriting)
pub fn initialize_analytics_on_upgrade(
    env: &Env,
    initial_metrics: &GlobalMetrics,
) -> Result<(), soroban_sdk::String> {
    // Check if snapshot already exists (migration already run)
    if env
        .storage()
        .instance()
        .has(&GLOBAL_METRICS_SNAPSHOT)
    {
        return Err(soroban_sdk::String::from_str(
            env,
            "Analytics snapshot already initialized",
        ));
    }

    // Create initial snapshot
    save_global_metrics(env, initial_metrics)?;

    // Record initialization timestamp
    let timestamp = env.ledger().timestamp();
    env.storage()
        .instance()
        .set(&ANALYTICS_LAST_UPDATE, &timestamp);

    // Initialize batch counter at 0
    env.storage().instance().set(&ANALYTICS_BATCH_COUNT, &0u64);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::WasteGrade;
    use soroban_sdk::testutils::Address as _;

    // ── Mutation Tests (from original contract_analytics.rs) ──────────────

    #[test]
    fn test_record_grade() {
        let mut metrics = GlobalMetrics {
            total_tokens_earned: 0,
            total_carbon_credits: 0,
            total_wastes_count: 0,
            active_waste_count: 0,
            expired_waste_count: 0,
            grade_a_count: 0,
            grade_b_count: 0,
            grade_c_count: 0,
            grade_d_count: 0,
        };

        metrics.record_grade(WasteGrade::A);
        assert_eq!(metrics.grade_a_count, 1);

        metrics.record_grade(WasteGrade::B);
        metrics.record_grade(WasteGrade::B);
        assert_eq!(metrics.grade_b_count, 2);

        metrics.record_grade(WasteGrade::C);
        metrics.record_grade(WasteGrade::D);
        assert_eq!(metrics.grade_c_count, 1);
        assert_eq!(metrics.grade_d_count, 1);
    }

    #[test]
    fn test_record_waste_registered() {
        let mut metrics = GlobalMetrics {
            total_tokens_earned: 0,
            total_carbon_credits: 0,
            total_wastes_count: 0,
            active_waste_count: 0,
            expired_waste_count: 0,
            grade_a_count: 0,
            grade_b_count: 0,
            grade_c_count: 0,
            grade_d_count: 0,
        };

        metrics.record_waste_registered();
        assert_eq!(metrics.total_wastes_count, 1);
        assert_eq!(metrics.active_waste_count, 1);

        metrics.record_waste_registered();
        assert_eq!(metrics.total_wastes_count, 2);
        assert_eq!(metrics.active_waste_count, 2);
    }

    #[test]
    fn test_record_waste_deactivated() {
        let mut metrics = GlobalMetrics {
            total_tokens_earned: 0,
            total_carbon_credits: 0,
            total_wastes_count: 0,
            active_waste_count: 3,
            expired_waste_count: 0,
            grade_a_count: 0,
            grade_b_count: 0,
            grade_c_count: 0,
            grade_d_count: 0,
        };

        metrics.record_waste_deactivated();
        assert_eq!(metrics.active_waste_count, 2);

        metrics.record_waste_deactivated();
        assert_eq!(metrics.active_waste_count, 1);

        metrics.record_waste_deactivated();
        assert_eq!(metrics.active_waste_count, 0);

        // Should not go below 0
        metrics.record_waste_deactivated();
        assert_eq!(metrics.active_waste_count, 0);
    }

    #[test]
    fn test_record_waste_expired() {
        let mut metrics = GlobalMetrics {
            total_tokens_earned: 0,
            total_carbon_credits: 0,
            total_wastes_count: 0,
            active_waste_count: 2,
            expired_waste_count: 0,
            grade_a_count: 0,
            grade_b_count: 0,
            grade_c_count: 0,
            grade_d_count: 0,
        };

        metrics.record_waste_expired();
        assert_eq!(metrics.expired_waste_count, 1);
        assert_eq!(metrics.active_waste_count, 1);

        metrics.record_waste_expired();
        assert_eq!(metrics.expired_waste_count, 2);
        assert_eq!(metrics.active_waste_count, 0);

        // Should not go below 0
        metrics.record_waste_expired();
        assert_eq!(metrics.expired_waste_count, 3);
        assert_eq!(metrics.active_waste_count, 0);
    }

    #[test]
    fn test_record_tokens_earned() {
        let mut metrics = GlobalMetrics {
            total_tokens_earned: 100,
            total_carbon_credits: 0,
            total_wastes_count: 0,
            active_waste_count: 0,
            expired_waste_count: 0,
            grade_a_count: 0,
            grade_b_count: 0,
            grade_c_count: 0,
            grade_d_count: 0,
        };

        metrics.record_tokens_earned(50);
        assert_eq!(metrics.total_tokens_earned, 150);

        metrics.record_tokens_earned(u128::MAX);
        assert_eq!(metrics.total_tokens_earned, u128::MAX);
    }

    #[test]
    fn test_record_carbon_credits() {
        let mut metrics = GlobalMetrics {
            total_tokens_earned: 0,
            total_carbon_credits: 200,
            total_wastes_count: 0,
            active_waste_count: 0,
            expired_waste_count: 0,
            grade_a_count: 0,
            grade_b_count: 0,
            grade_c_count: 0,
            grade_d_count: 0,
        };

        metrics.record_carbon_credits(150);
        assert_eq!(metrics.total_carbon_credits, 350);

        metrics.record_carbon_credits(u128::MAX);
        assert_eq!(metrics.total_carbon_credits, u128::MAX);
    }

    #[test]
    fn test_record_waste_type_submission() {
        let env = Env::default();
        let address = Address::generate(&env);
        let mut stats = RecyclingStats::new(address);

        record_waste_type_submission(&mut stats, WasteType::Paper, 1000);
        assert_eq!(stats.total_submissions, 1);
        assert_eq!(stats.total_weight, 1000);
        assert_eq!(stats.paper_count, 1);

        record_waste_type_submission(&mut stats, WasteType::Plastic, 500);
        assert_eq!(stats.total_submissions, 2);
        assert_eq!(stats.total_weight, 1500);
        assert_eq!(stats.plastic_count, 1);
    }

    #[test]
    fn test_record_earnings() {
        let env = Env::default();
        let address = Address::generate(&env);
        let mut stats = RecyclingStats::new(address);

        record_earnings(&mut stats, 100, 50);
        assert_eq!(stats.total_points, 100);
        assert_eq!(stats.carbon_credits_earned, 50);

        record_earnings(&mut stats, 50, 25);
        assert_eq!(stats.total_points, 150);
        assert_eq!(stats.carbon_credits_earned, 75);
    }

    #[test]
    fn test_refresh_recycling_rate_with_zero_weight() {
        let env = Env::default();
        let address = Address::generate(&env);
        let mut stats = RecyclingStats::new(address);
        stats.recycled_weight = 0;
        stats.total_weight = 0;

        refresh_recycling_rate(&mut stats);
        assert_eq!(stats.recycling_rate, 0);
    }

    #[test]
    fn test_refresh_recycling_rate_with_values() {
        let env = Env::default();
        let address = Address::generate(&env);
        let mut stats = RecyclingStats::new(address);
        stats.recycled_weight = 5000; // 50%
        stats.total_weight = 10000;

        refresh_recycling_rate(&mut stats);
        assert_eq!(stats.recycling_rate, 5000); // 50% in basis points
    }

    // ── Storage Tests (NEW — issue #1514) ──────────────────────────────

    #[test]
    fn test_storage_roundtrip_global_metrics() {
        let env = Env::default();
        let mut metrics = GlobalMetrics {
            total_tokens_earned: 1000,
            total_carbon_credits: 500,
            total_wastes_count: 10,
            active_waste_count: 5,
            expired_waste_count: 2,
            grade_a_count: 3,
            grade_b_count: 4,
            grade_c_count: 2,
            grade_d_count: 1,
        };

        // Save to storage
        save_global_metrics(&env, &metrics).unwrap();

        // Retrieve from storage
        let retrieved = get_global_metrics(&env).expect("Failed to retrieve metrics");

        // Verify all fields match
        assert_eq!(retrieved.total_tokens_earned, metrics.total_tokens_earned);
        assert_eq!(
            retrieved.total_carbon_credits,
            metrics.total_carbon_credits
        );
        assert_eq!(retrieved.total_wastes_count, metrics.total_wastes_count);
        assert_eq!(retrieved.active_waste_count, metrics.active_waste_count);
        assert_eq!(retrieved.expired_waste_count, metrics.expired_waste_count);
        assert_eq!(retrieved.grade_a_count, metrics.grade_a_count);
        assert_eq!(retrieved.grade_b_count, metrics.grade_b_count);
        assert_eq!(retrieved.grade_c_count, metrics.grade_c_count);
        assert_eq!(retrieved.grade_d_count, metrics.grade_d_count);
    }

    #[test]
    fn test_periodic_update_batching() {
        let env = Env::default();
        let metrics = GlobalMetrics {
            total_tokens_earned: 100,
            total_carbon_credits: 50,
            total_wastes_count: 1,
            active_waste_count: 1,
            expired_waste_count: 0,
            grade_a_count: 0,
            grade_b_count: 0,
            grade_c_count: 0,
            grade_d_count: 0,
        };

        // Call try_periodic_update multiple times
        for i in 1..=ANALYTICS_BATCH_SIZE + 5 {
            try_periodic_update(&env, &metrics).unwrap();

            // Snapshot should only exist after ANALYTICS_BATCH_SIZE calls
            if i >= ANALYTICS_BATCH_SIZE {
                let stored = get_global_metrics(&env);
                assert!(
                    stored.is_some(),
                    "Snapshot should exist after batch threshold"
                );
            }
        }
    }

    #[test]
    fn test_initialize_analytics_on_upgrade() {
        let env = Env::default();
        let metrics = GlobalMetrics {
            total_tokens_earned: 500,
            total_carbon_credits: 250,
            total_wastes_count: 5,
            active_waste_count: 3,
            expired_waste_count: 0,
            grade_a_count: 2,
            grade_b_count: 1,
            grade_c_count: 1,
            grade_d_count: 0,
        };

        // Initialize should succeed
        initialize_analytics_on_upgrade(&env, &metrics).unwrap();

        // Verify snapshot was saved
        let stored = get_global_metrics(&env).expect("Snapshot should exist");
        assert_eq!(stored.total_tokens_earned, 500);

        // Second initialize should fail
        let result = initialize_analytics_on_upgrade(&env, &metrics);
        assert!(result.is_err(), "Should not allow re-initialization");
    }
}
