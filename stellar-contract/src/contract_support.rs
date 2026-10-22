use super::types::ParticipantTier;
use super::{CertificationLevel, ParticipantRole, RecyclingStats};
use soroban_sdk::{contracttype, symbol_short, Address, Symbol, Vec};

// Storage keys
//
// Storage layout strategy (issue #758):
// ─────────────────────────────────────
// • Instance storage  – small, frequently-read scalars that are loaded on
//   every contract invocation (admin, reward config, reentrancy guard, pause
//   flag).  Kept to a minimum to reduce the base ledger-entry read fee.
// • Persistent storage – per-entity records keyed by address or ID.
//   Uses typed enum keys to avoid string hashing overhead.
// • Temporary storage  – ephemeral values (reentrancy guard) that must not
//   survive TTL expiry.
//
// Symbol names are kept ≤ 9 chars (Soroban Symbol limit) and are documented
// here so that future storage migrations have a clear audit trail.
pub(crate) const ADMINS: Symbol = symbol_short!("ADMINS");
pub(crate) const CHARITY: Symbol = symbol_short!("CHARITY");
pub(crate) const REWARD_CFG: Symbol = symbol_short!("RWD_CFG");
pub(crate) const TOTAL_WEIGHT: Symbol = symbol_short!("TOT_WGT");
pub(crate) const TOTAL_TOKENS: Symbol = symbol_short!("TOT_TKN");
pub(crate) const REENTRANCY_GUARD: Symbol = symbol_short!("RE_GUARD");
pub(crate) const TOKEN_ADDR: Symbol = symbol_short!("TKN_ADDR");
pub(crate) const PART_INDEX: Symbol = symbol_short!("PART_IDX");
pub(crate) const PAUSED: Symbol = symbol_short!("PAUSED");
pub(crate) const MULTISIG_THRESHOLD: Symbol = symbol_short!("MS_THRESH");
pub(crate) const PROPOSAL_COUNT: Symbol = symbol_short!("PROP_CNT");
pub(crate) const MIN_WEIGHT: Symbol = symbol_short!("MIN_WGT");

// New feature storage keys
pub(crate) const CHALLENGE_COUNT: Symbol = symbol_short!("CHAL_CNT");
pub(crate) const PENDING_XFR_CNT: Symbol = symbol_short!("PXFR_CNT");
pub(crate) const MILESTONES_KEY: Symbol = symbol_short!("MLSTONES");
pub(crate) const AUCTION_COUNT: Symbol = symbol_short!("AUC_CNT");

// Pre-existing missing constants
pub(crate) const SEASONAL_MUL: Symbol = symbol_short!("SEAS_MUL");
pub(crate) const TOTAL_CARBON: Symbol = symbol_short!("TOT_CARB");
pub(crate) const CONTAMINATED_LIST: Symbol = symbol_short!("CONT_LST");

// Carbon credit marketplace counter and active-listing index
pub(crate) const CARB_LIST_CNT: Symbol = symbol_short!("CARB_CNT");
pub(crate) const CARB_LIST_IDX: Symbol = symbol_short!("CARB_IDX");

// Dispute system counters (issue #549)
pub(crate) const DISPUTE_CNT: Symbol = symbol_short!("DISP_CNT");

// Collection route counters (issue #552)
pub(crate) const ROUTE_CNT: Symbol = symbol_short!("ROUTE_CNT");

// Issue #704: RBAC permission storage key prefix
pub(crate) const PERMISSIONS: Symbol = symbol_short!("PERMS");

// Issue #706: Reconciliation audit trail storage key prefix
pub(crate) const RECONCIL_LOG: Symbol = symbol_short!("REC_LOG");

// Issue #654: Quality Scoring storage keys
pub(crate) const QUALITY_SCORES: Symbol = symbol_short!("QUAL_SC");

// Issue #655: Location Tracking storage keys
pub(crate) const LOCATION_HISTORY: Symbol = symbol_short!("LOC_HIST");

// Issue #656: Batch Tracking storage keys
pub(crate) const BATCH_COUNT: Symbol = symbol_short!("BATCH_CNT");
pub(crate) const BATCH_INDEX: Symbol = symbol_short!("BATCH_IDX");

// Issue #657: Certification storage keys
pub(crate) const CERTIFICATIONS: Symbol = symbol_short!("CERT_IDX");

// Issue #700: Compliance Reporting storage keys
pub(crate) const REPORT_COUNT: Symbol = symbol_short!("REP_CNT");
pub(crate) const REPORTS: Symbol = symbol_short!("REPORTS");

// Issue #703: Performance Benchmarking storage keys
pub(crate) const TRANSACTION_STATS: Symbol = symbol_short!("TX_STATS");
pub(crate) const PERF_SNAPSHOTS: Symbol = symbol_short!("PERF_SNP");

// Issue #700: High-value transfer approval storage keys
pub(crate) const TRANSFER_THRESHOLD: Symbol = symbol_short!("XFR_THRSH");
pub(crate) const REQUIRED_APPROVERS: Symbol = symbol_short!("REQ_APPR");
pub(crate) const TRANSFER_APPROVALS: Symbol = symbol_short!("XFR_APPR");

// Reputation delta constants
pub(crate) const REP_TRANSFER: i128 = 5;
pub(crate) const REP_CONFIRM: i128 = 3;
pub(crate) const REP_VERIFY: i128 = 10;

/// Reputation score bounds
pub(crate) const REP_MAX: i128 = 10_000;
pub(crate) const REP_MIN: i128 = -1_000;

/// Reputation decay configuration: lose 1 point per day after 30 days of inactivity.
pub(crate) const DECAY_WINDOW_SECS: u64 = 30 * 24 * 3600;
pub(crate) const DECAY_PER_DAY: i128 = 1;

/// 7 days in seconds
pub(crate) const PROPOSAL_TTL_SECS: u64 = 7 * 24 * 60 * 60;

/// 24 hours in seconds (transfer approval expiry)
pub(crate) const TRANSFER_EXPIRY_SECS: u64 = 24 * 60 * 60;

/// Max active challenges
pub(crate) const MAX_ACTIVE_CHALLENGES: u32 = 10;

/// Min auction duration: 1 hour in seconds
pub(crate) const MIN_AUCTION_DURATION: u64 = 60 * 60;

/// Max auction duration: 7 days in seconds
pub(crate) const MAX_AUCTION_DURATION: u64 = 7 * 24 * 60 * 60;

/// Min bid increment: 5%
pub(crate) const MIN_BID_INCREMENT_PERCENT: u128 = 5;

/// Predefined milestone thresholds in grams
pub(crate) const MILESTONE_THRESHOLDS: [u128; 7] = [
    100_000,
    500_000,
    1_000_000,
    5_000_000,
    10_000_000,
    50_000_000,
    100_000_000,
];

/// Actions that require multi-sig approval.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AdminAction {
    TransferAdmin(Vec<Address>),
    SetPercentages(u32, u32),
    DeactivateWaste(u128),
}

/// A pending multi-sig proposal.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminProposal {
    pub id: u64,
    pub action: AdminAction,
    pub proposer: Address,
    pub approvers: Vec<Address>,
    pub executed: bool,
    pub created_at: u64,
}

/// Maximum allowed waste weight per submission (1 000 000 kg in grams).
pub(crate) const MAX_WASTE_WEIGHT: u128 = 1_000_000_000;

/// Reward distribution percentages stored as a single instance-storage entry.
///
/// Consolidating `collector_percentage` and `owner_percentage` into one struct
/// means a single `storage.get` call fetches both values, halving the number
/// of instance-storage lookups on every `_reward_tokens` invocation.
///
/// Migration note: contracts deployed with the old two-key layout
/// (`COL_PCT` / `OWN_PCT`) should call `set_percentages` once after upgrade
/// to write the new `RWD_CFG` key; the old keys are then unused and will
/// expire with the instance TTL.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardConfig {
    /// Percentage of total reward distributed to each collector in the transfer chain.
    pub collector_percentage: u32,
    /// Percentage of total reward distributed to the current waste owner.
    pub owner_percentage: u32,
}

/// On-chain record for a registered supply-chain participant.
///
/// Responsibility boundary (audited under issue #1100): this struct and the
/// participant-related functions on `ScavengerContract` below (
/// `register_participant`, `update_role`, `deregister_participant`,
/// `get_participant`, storage helpers like `set_participant` /
/// `is_participant_registered`, …) are the **live** implementation — this is
/// what every deployed entry point actually calls. `participant.rs` is a
/// separate, currently-unwired helper module extracted under issue #759;
/// see its module doc for the full audit of the gap between the two and why
/// closing it is left as a follow-up rather than attempted in this change.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Participant {
    pub address: Address,
    pub role: ParticipantRole,
    pub name: soroban_sdk::Symbol,
    /// Latitude in microdegrees (e.g. 1_000_000 = 1.0°).
    pub latitude: i128,
    /// Longitude in microdegrees.
    pub longitude: i128,
    pub is_registered: bool,
    /// Cumulative grams of waste processed.
    pub total_waste_processed: u128,
    /// Cumulative reward tokens earned.
    pub total_tokens_earned: u128,
    /// Ledger timestamp at registration.
    pub registered_at: u64,
    /// Reputation score in range [-1000, 10000].
    pub reputation_score: i128,
    /// Ledger timestamp of last activity (for decay).
    pub last_active_at: u64,
    /// Certification level based on activity and accuracy
    pub certification: CertificationLevel,
    /// Participant tier (Bronze, Silver, Gold, Platinum)
    pub tier: ParticipantTier,
}

/// Combined view of a participant and their recycling statistics.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParticipantInfo {
    pub participant: Participant,
    pub stats: RecyclingStats,
}
