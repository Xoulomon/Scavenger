use super::*;

/// A single tier in a tiered incentive program.
/// Reward is `reward_points` per kg for waste weight in [min_weight_kg, max_weight_kg).
/// `max_weight_kg == 0` means unbounded (no upper limit).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IncentiveTier {
    /// Minimum weight in kg (inclusive) for this tier to apply
    pub min_weight_kg: u64,
    /// Maximum weight in kg (exclusive); 0 means unbounded
    pub max_weight_kg: u64,
    /// Reward points per kg for this tier
    pub reward_points: u64,
}

/// Represents an incentive offered by a manufacturer to encourage recycling.
///
/// # Storage layout optimization (issue #758)
/// u64 budget fields are placed together so a single XDR pass serializes them
/// without interleaving variable-width fields (Address, Vec), cutting per-call
/// deserialization cost when only budget data is needed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Incentive {
    /// Unique identifier for the incentive
    pub id: u64,
    /// Address of the manufacturer offering the incentive
    pub rewarder: Address,
    /// Type of waste this incentive targets
    pub waste_type: WasteType,
    /// Reward points per kilogram (used when no tiers are set)
    pub reward_points: u64,
    /// Total points budget allocated for this incentive
    pub total_budget: u64,
    /// Remaining points budget available
    pub remaining_budget: u64,
    /// Whether the incentive is currently active
    pub active: bool,
    /// Timestamp when the incentive was created
    pub created_at: u64,
    /// Optional UTC timestamp when the incentive becomes active
    pub starts_at: Option<u64>,
    /// Optional UTC timestamp when the incentive expires
    pub ends_at: Option<u64>,
    /// Optional tiered reward rates
    pub tiers: soroban_sdk::Vec<IncentiveTier>,
}

impl Incentive {
    /// Creates a new Incentive instance
    pub fn new(
        id: u64,
        rewarder: Address,
        waste_type: WasteType,
        reward_points: u64,
        total_budget: u64,
        created_at: u64,
        env: &soroban_sdk::Env,
    ) -> Self {
        Self {
            id,
            rewarder,
            waste_type,
            reward_points,
            total_budget,
            remaining_budget: total_budget,
            active: true,
            created_at,
            starts_at: None,
            ends_at: None,
            tiers: soroban_sdk::Vec::new(env),
        }
    }

    /// Deactivates the incentive
    pub fn deactivate(&mut self) {
        self.active = false;
    }

    /// Calculates reward for a given weight in grams.
    /// Uses tiered rates if tiers are set; falls back to flat `reward_points`.
    pub fn calculate_reward(&self, weight_grams: u64) -> u64 {
        let weight_kg = weight_grams / 1000;
        if self.tiers.is_empty() {
            return weight_kg
                .checked_mul(self.reward_points)
                .expect("Overflow in reward calculation");
        }
        // Find the matching tier (tiers are sorted by min_weight_kg ascending)
        for i in 0..self.tiers.len() {
            let tier = self.tiers.get(i).unwrap();
            let in_lower = weight_kg >= tier.min_weight_kg;
            let in_upper = tier.max_weight_kg == 0 || weight_kg < tier.max_weight_kg;
            if in_lower && in_upper {
                return weight_kg
                    .checked_mul(tier.reward_points)
                    .expect("Overflow in reward calculation");
            }
        }
        // No tier matched — fall back to flat rate
        weight_kg
            .checked_mul(self.reward_points)
            .expect("Overflow in reward calculation")
    }

    /// Attempts to claim a reward, returns the amount claimed
    /// Returns None if insufficient budget
    pub fn claim_reward(&mut self, weight_grams: u64) -> Option<u64> {
        if !self.active {
            return None;
        }

        let reward = self.calculate_reward(weight_grams);
        if reward > self.remaining_budget {
            return None;
        }

        self.remaining_budget = self
            .remaining_budget
            .checked_sub(reward)
            .expect("Overflow in remaining budget");

        // Auto-deactivate if budget exhausted
        if self.remaining_budget == 0 {
            self.active = false;
        }

        Some(reward)
    }

    /// Checks if the incentive has sufficient budget for a reward
    pub fn has_sufficient_budget(&self, weight_grams: u64) -> bool {
        if !self.active {
            return false;
        }
        let reward = self.calculate_reward(weight_grams);
        reward <= self.remaining_budget
    }
}

/// Seasonal reward multiplier stored as basis points (100 = 1x, 150 = 1.5x, 500 = 5x max).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SeasonalMultiplier {
    /// Multiplier in basis points (e.g. 150 = 1.5x). Max 500 (5x).
    pub multiplier: u32,
    /// Unix timestamp when the multiplier becomes active.
    pub start: u64,
    /// Unix timestamp when the multiplier expires.
    pub end: u64,
}

// ========== Milestone Types ==========

/// A recycling milestone with threshold and bonus
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    /// Threshold in grams
    pub threshold: u128,
    pub title: soroban_sdk::Symbol,
    /// Bonus percentage (e.g. 10 = 10% of total_tokens_earned)
    pub bonus_pct: u32,
}
