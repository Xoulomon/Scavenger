use super::*;

/// Status of a collection route.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RouteStatus {
    /// Route created, not yet started
    Pending = 0,
    /// Route completed by the collector
    Completed = 1,
    /// Route cancelled
    Cancelled = 2,
}

/// A collection route grouping nearby waste items for a collector.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollectionRoute {
    /// Unique route ID
    pub id: u64,
    /// Collector assigned to this route
    pub collector: Address,
    /// Ordered list of v2 waste IDs to collect (max 50)
    pub waste_ids: soroban_sdk::Vec<u128>,
    /// Current status
    pub status: RouteStatus,
    /// Ledger timestamp when route was created
    pub created_at: u64,
}

// ========== Challenge Types ==========

/// Status of a challenge
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ChallengeStatus {
    Active = 0,
    Completed = 1,
    Expired = 2,
}

/// A time-limited recycling challenge with special rewards
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Challenge {
    pub id: u64,
    pub title: soroban_sdk::Symbol,
    /// Target weight in grams
    pub target_weight: u128,
    pub waste_type: WasteType,
    pub start_time: u64,
    pub end_time: u64,
    /// Bonus reward tokens for completing the challenge
    pub reward: u128,
    pub status: ChallengeStatus,
    pub creator: Address,
}

/// A participant's progress in a challenge
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChallengeProgress {
    pub challenge_id: u64,
    pub participant: Address,
    /// Weight processed toward the challenge target (grams)
    pub weight_processed: u128,
    pub completed: bool,
    pub joined_at: u64,
}

// ========== Dispute Resolution Types (issue #549) ==========

/// Status of a dispute over a waste item
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DisputeStatus {
    /// Dispute opened, awaiting admin resolution
    Pending = 0,
    /// Admin accepted the dispute
    Resolved = 1,
    /// Admin rejected the dispute
    Rejected = 2,
}

/// A dispute raised against a waste item
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Dispute {
    pub id: u64,
    pub waste_id: u128,
    pub disputer: Address,
    pub reason: soroban_sdk::String,
    pub status: DisputeStatus,
    pub created_at: u64,
    pub resolved_at: u64,
    pub resolution_note: soroban_sdk::String,
}
