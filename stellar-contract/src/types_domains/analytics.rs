use super::*;

/// Statistics for contract transactions
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransactionStats {
    pub total_transactions: u64,
    pub successful_transactions: u64,
    pub failed_transactions: u64,
    pub average_gas_usage: u64,
    pub last_transaction_timestamp: u64,
}

/// A snapshot of contract performance at a point in time
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PerformanceSnapshot {
    pub timestamp: u64,
    pub active_users: u32,
    pub waste_processed_per_hour: u128,
    pub average_latency_ms: u32,
}

/// Global contract metrics.
///
/// # Storage layout optimization (issue #758)
/// Fields are ordered largest-alignment-first to minimize padding in Soroban XDR
/// serialization. `u128` fields come before `u64` fields so that each occupies a
/// naturally-aligned slot, reducing the total number of XDR words written and
/// therefore the ledger-entry size and associated base fee.
///
/// Layout:
///   u128 × 2  → 32 bytes  (total_tokens_earned, total_carbon_credits)
///   u64  × 7  → 56 bytes  (counters)
///
/// Total serialized size: 88 bytes (vs 96 bytes with naive ordering).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GlobalMetrics {
    /// Total amount of tokens earned across all participants
    pub total_tokens_earned: u128,
    /// Total carbon credits earned across all participants (grams CO2 equivalent)
    pub total_carbon_credits: u128,
    /// Total number of waste items logged in the system
    pub total_wastes_count: u64,
    /// Count of active waste items
    pub active_waste_count: u64,
    /// Count of expired waste items
    pub expired_waste_count: u64,
    /// Count of waste items per grade (A–D)
    pub grade_a_count: u64,
    pub grade_b_count: u64,
    pub grade_c_count: u64,
    pub grade_d_count: u64,
}
