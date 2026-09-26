//! Storage key audit and naming convention enforcement.
//!
//! This module enumerates all storage key constructors across the
//! contract modules and provides tests to verify no two distinct
//! key builders produce the same key for valid inputs.
//!
//! # Naming Convention
//!
//! All storage keys follow these conventions:
//! - Instance storage keys: uppercase symbols ≤ 9 chars (Soroban Symbol limit)
//! - Persistent storage keys: string tuples like `("waste", id)`, `("grade_history", id)`
//! - Counter keys: `("waste_count",)`, `("incentive_count",)`, etc.
//! - Module-specific keys: `("stats", address)`, `("cache", key)`, etc.
//!
//! Each key constant has a doc comment explaining its purpose and the
//! issue it was introduced for.

use soroban_sdk::{Address, Env, Symbol};

// ── Instance Storage Keys ─────────────────────────────────────────────
// These are Soroban Symbol constants used in instance storage.
// All must be ≤ 9 chars per Soroban Symbol limit.

/// Admin list storage key (issue #758).
pub const ADMINS: Symbol = Symbol::from_static_str("ADMINS");

/// Charity contract address key (issue #758).
pub const CHARITY: Symbol = Symbol::from_static_str("CHARITY");

/// Reward configuration key (issue #758).
pub const REWARD_CFG: Symbol = Symbol::from_static_str("RWD_CFG");

/// Total weight counter (issue #758).
pub const TOTAL_WEIGHT: Symbol = Symbol::from_static_str("TOT_WGT");

/// Total tokens counter (issue #758).
pub const TOTAL_TOKENS: Symbol = Symbol::from_static_str("TOT_TKN");

/// Reentrancy guard flag (issue #758).
pub const REENTRANCY_GUARD: Symbol = Symbol::from_static_str("RE_GUARD");

/// Token contract address (issue #758).
pub const TOKEN_ADDR: Symbol = Symbol::from_static_str("TKN_ADDR");

/// Participant index (issue #758).
pub const PART_INDEX: Symbol = Symbol::from_static_str("PART_IDX");

/// Pause flag (issue #758).
pub const PAUSED: Symbol = Symbol::from_static_str("PAUSED");

/// Multisig threshold (issue #758).
pub const MULTISIG_THRESHOLD: Symbol = Symbol::from_static_str("MS_THRESH");

/// Proposal counter (issue #758).
pub const PROPOSAL_COUNT: Symbol = Symbol::from_static_str("PROP_CNT");

/// Minimum weight setting (issue #758).
pub const MIN_WEIGHT: Symbol = Symbol::from_static_str("MIN_WGT");

// ── New Feature Storage Keys ──────────────────────────────────────────

/// Challenge counter (issue #704).
pub const CHALLENGE_COUNT: Symbol = Symbol::from_static_str("CHAL_CNT");

/// Pending transfer counter (issue #704).
pub const PENDING_XFR_CNT: Symbol = Symbol::from_static_str("PXFR_CNT");

/// Milestones key (issue #704).
pub const MILESTONES_KEY: Symbol = Symbol::from_static_str("MLSTONES");

/// Auction counter (issue #704).
pub const AUCTION_COUNT: Symbol = Symbol::from_static_str("AUC_CNT");

// ── Pre-existing Storage Keys ─────────────────────────────────────────

/// Seasonal multiplier (issue #758).
pub const SEASONAL_MUL: Symbol = Symbol::from_static_str("SEAS_MUL");

/// Total carbon credits (issue #758).
pub const TOTAL_CARBON: Symbol = Symbol::from_static_str("TOT_CARB");

/// Contaminated list (issue #758).
pub const CONTAMINATED_LIST: Symbol = Symbol::from_static_str("CONT_LST");

// ── Carbon Credit Marketplace Keys ────────────────────────────────────

/// Carbon listing counter (issue #758).
pub const CARB_LIST_CNT: Symbol = Symbol::from_static_str("CARB_CNT");

/// Carbon listing index (issue #758).
pub const CARB_LIST_IDX: Symbol = Symbol::from_static_str("CARB_IDX");

// ── Dispute System Keys ───────────────────────────────────────────────

/// Dispute counter (issue #549).
pub const DISPUTE_CNT: Symbol = Symbol::from_static_str("DISP_CNT");

// ── Collection Route Keys ─────────────────────────────────────────────

/// Route counter (issue #552).
pub const ROUTE_CNT: Symbol = Symbol::from_static_str("ROUTE_CNT");

// ── Issue #704: RBAC Permission Keys ──────────────────────────────────

/// Permissions key (issue #704).
pub const PERMISSIONS: Symbol = Symbol::from_static_str("PERMS");

// ── Issue #706: Reconciliation Audit Trail Keys ───────────────────────

/// Reconciliation log (issue #706).
pub const RECONCIL_LOG: Symbol = Symbol::from_static_str("REC_LOG");

// ── Issue #654: Quality Scoring Keys ──────────────────────────────────

/// Quality scores (issue #654).
pub const QUALITY_SCORES: Symbol = Symbol::from_static_str("QUAL_SC");

// ── Issue #655: Location Tracking Keys ────────────────────────────────

/// Location history (issue #655).
pub const LOCATION_HISTORY: Symbol = Symbol::from_static_str("LOC_HIST");

// ── Issue #656: Batch Tracking Keys ───────────────────────────────────

/// Batch counter (issue #656).
pub const BATCH_COUNT: Symbol = Symbol::from_static_str("BATCH_CNT");

/// Batch index (issue #656).
pub const BATCH_INDEX: Symbol = Symbol::from_static_str("BATCH_IDX");

// ── Issue #657: Certification Keys ────────────────────────────────────

/// Certifications index (issue #657).
pub const CERTIFICATIONS: Symbol = Symbol::from_static_str("CERT_IDX");

// ── Issue #700: Compliance Reporting Keys ─────────────────────────────

/// Report counter (issue #700).
pub const REPORT_COUNT: Symbol = Symbol::from_static_str("REP_CNT");

/// Reports (issue #700).
pub const REPORTS: Symbol = Symbol::from_static_str("REPORTS");

// ── Issue #703: Performance Benchmarking Keys ─────────────────────────

/// Transaction stats (issue #703).
pub const TRANSACTION_STATS: Symbol = Symbol::from_static_str("TX_STATS");

/// Performance snapshots (issue #703).
pub const PERF_SNAPSHOTS: Symbol = Symbol::from_static_str("PERF_SNP");

// ── Issue #700: High-value Transfer Approval Keys ─────────────────────

/// Transfer threshold (issue #700).
pub const TRANSFER_THRESHOLD: Symbol = Symbol::from_static_str("XFR_THRSH");

/// Required approvers (issue #700).
pub const REQUIRED_APPROVERS: Symbol = Symbol::from_static_str("REQ_APPR");

/// Transfer approvals (issue #700).
pub const TRANSFER_APPROVALS: Symbol = Symbol::from_static_str("XFR_APPR");

// ── Persistent Storage Key Constructors ───────────────────────────────
// These return the actual storage key used in `env.storage().instance().get/set`.

/// Returns the participant storage key.
pub fn participant_key(address: &Address) -> (Address,) {
    (address.clone(),)
}

/// Returns the waste v2 storage key.
pub fn waste_v2_key(waste_id: u128) -> (String, u128) {
    ("waste_v2".to_string(), waste_id)
}

/// Returns the waste storage key (v1).
pub fn waste_key(waste_id: u64) -> (String, u64) {
    ("waste", waste_id)
}

/// Returns the grade history storage key.
pub fn grade_history_key(waste_id: u128) -> (String, u128) {
    ("grade_history", waste_id)
}

/// Returns the stats storage key for a participant.
pub fn stats_key(address: &Address) -> (String, Address) {
    ("stats", address.clone())
}

/// Returns the transfer history storage key.
pub fn transfer_history_key(waste_id: u128) -> (String, u128) {
    ("transfer_history", waste_id)
}

/// Returns the waste count key.
pub fn waste_count_key() -> (String,) {
    ("waste_count",)
}

/// Returns the incentive count key.
pub fn incentive_count_key() -> (String,) {
    ("incentive_count",)
}

/// Returns the incentive storage key.
pub fn incentive_key(incentive_id: u64) -> (String, u64) {
    ("incentive", incentive_id)
}

/// Returns the auction storage key.
pub fn auction_key(auction_id: u64) -> (String, u64) {
    ("auction", auction_id)
}

/// Returns the AI grade confidence key.
pub fn ai_grade_conf_key(waste_id: u128) -> (String, u128) {
    ("ai_grade_conf", waste_id)
}

// ── Collision Tests ───────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Address;
    use soroban_sdk::Env;

    /// Verify all Symbol constants are ≤ 9 chars (Soroban limit).
    #[test]
    fn test_symbol_key_length_constraint() {
        let keys: Vec<Symbol> = vec![
            ADMINS, CHARITY, REWARD_CFG, TOTAL_WEIGHT, TOTAL_TOKENS,
            REENTRANCY_GUARD, TOKEN_ADDR, PART_INDEX, PAUSED,
            MULTISIG_THRESHOLD, PROPOSAL_COUNT, MIN_WEIGHT,
            CHALLENGE_COUNT, PENDING_XFR_CNT, MILESTONES_KEY,
            AUCTION_COUNT, SEASONAL_MUL, TOTAL_CARBON, CONTAMINATED_LIST,
            CARB_LIST_CNT, CARB_LIST_IDX, DISPUTE_CNT, ROUTE_CNT,
            PERMISSIONS, RECONCIL_LOG, QUALITY_SCORES, LOCATION_HISTORY,
            BATCH_COUNT, BATCH_INDEX, CERTIFICATIONS, REPORT_COUNT,
            REPORTS, TRANSACTION_STATS, PERF_SNAPSHOTS,
            TRANSFER_THRESHOLD, REQUIRED_APPROVERS, TRANSFER_APPROVALS,
        ];
        for key in keys {
            let s = key.to_string();
            assert!(
                s.len() <= 9,
                "Symbol key '{}' exceeds 9-char limit",
                s
            );
        }
    }

    /// Verify no two Symbol constants produce the same key.
    #[test]
    fn test_no_symbol_key_collisions() {
        let keys = vec![
            ADMINS.to_string(), CHARITY.to_string(), REWARD_CFG.to_string(),
            TOTAL_WEIGHT.to_string(), TOTAL_TOKENS.to_string(),
            REENTRANCY_GUARD.to_string(), TOKEN_ADDR.to_string(),
            PART_INDEX.to_string(), PAUSED.to_string(),
            MULTISIG_THRESHOLD.to_string(), PROPOSAL_COUNT.to_string(),
            MIN_WEIGHT.to_string(), CHALLENGE_COUNT.to_string(),
            PENDING_XFR_CNT.to_string(), MILESTONES_KEY.to_string(),
            AUCTION_COUNT.to_string(), SEASONAL_MUL.to_string(),
            TOTAL_CARBON.to_string(), CONTAMINATED_LIST.to_string(),
            CARB_LIST_CNT.to_string(), CARB_LIST_IDX.to_string(),
            DISPUTE_CNT.to_string(), ROUTE_CNT.to_string(),
            PERMISSIONS.to_string(), RECONCIL_LOG.to_string(),
            QUALITY_SCORES.to_string(), LOCATION_HISTORY.to_string(),
            BATCH_COUNT.to_string(), BATCH_INDEX.to_string(),
            CERTIFICATIONS.to_string(), REPORT_COUNT.to_string(),
            REPORTS.to_string(), TRANSACTION_STATS.to_string(),
            PERF_SNAPSHOTS.to_string(), TRANSFER_THRESHOLD.to_string(),
            REQUIRED_APPROVERS.to_string(), TRANSFER_APPROVALS.to_string(),
        ];
        let mut unique = keys.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(keys.len(), unique.len(), "Duplicate storage keys found");
    }

    /// Verify that different key constructors produce different keys.
    #[test]
    fn test_persistent_key_uniqueness() {
        let env = Env::default();
        let addr1 = Address::generate(&env);
        let addr2 = Address::generate(&env);

        // Same type, different addresses → different keys
        assert_ne!(participant_key(&addr1), participant_key(&addr2));
        // Same type, different IDs → different keys
        assert_ne!(waste_v2_key(1), waste_v2_key(2));
        assert_ne!(grade_history_key(1), grade_history_key(2));
        assert_ne!(transfer_history_key(1), transfer_history_key(2));
        // Different constructors → different keys
        assert_ne!(waste_v2_key(1), grade_history_key(1));
        assert_ne!(stats_key(&addr1), participant_key(&addr1));
        assert_ne!(waste_count_key(), incentive_count_key());
        assert_ne!(incentive_key(1), auction_key(1));
    }

    /// Verify that all persistent key constructors return unique values
    /// for valid inputs.
    #[test]
    fn test_all_persistent_key_types_distinct() {
        let env = Env::default();
        let addr = Address::generate(&env);

        let keys: Vec<(String, u128)> = vec![
            waste_v2_key(1),
            grade_history_key(1),
            transfer_history_key(1),
            ai_grade_conf_key(1),
        ];
        let mut unique = keys.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(keys.len(), unique.len(), "Persistent key collisions found");
    }
}
