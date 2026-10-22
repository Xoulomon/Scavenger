use super::*;

/// Represents the role of a participant in the Scavenger ecosystem
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ParticipantRole {
    /// Recycler role - responsible for collecting and processing recyclable materials
    Recycler = 0,
    /// Collector role - responsible for gathering materials from various sources
    Collector = 1,
    /// Manufacturer role - responsible for processing materials into new products
    Manufacturer = 2,
}

impl ParticipantRole {
    /// Validates if the role is a valid ParticipantRole variant
    pub fn is_valid(role: u32) -> bool {
        matches!(role, 0..=2)
    }

    /// Converts a u32 to a ParticipantRole
    /// Returns None if the value is invalid
    pub fn from_u32(value: u32) -> Option<Self> {
        match value {
            0 => Some(ParticipantRole::Recycler),
            1 => Some(ParticipantRole::Collector),
            2 => Some(ParticipantRole::Manufacturer),
            _ => None,
        }
    }

    /// Converts the ParticipantRole to u32
    pub fn to_u32(&self) -> u32 {
        *self as u32
    }

    /// Returns the string representation of the role
    pub fn as_str(&self) -> &'static str {
        match self {
            ParticipantRole::Recycler => "RECYCLER",
            ParticipantRole::Collector => "COLLECTOR",
            ParticipantRole::Manufacturer => "MANUFACTURER",
        }
    }

    /// Validates if a participant can perform a specific action based on their role
    pub fn can_collect_materials(&self) -> bool {
        matches!(self, ParticipantRole::Recycler | ParticipantRole::Collector)
    }

    /// Validates if a participant can manufacture products
    pub fn can_manufacture(&self) -> bool {
        matches!(self, ParticipantRole::Manufacturer)
    }

    /// Validates if a participant can process recyclables
    pub fn can_process_recyclables(&self) -> bool {
        matches!(self, ParticipantRole::Recycler)
    }
}

/// Represents the certification level of a participant based on activity and accuracy
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CertificationLevel {
    /// Beginner: 0-10 wastes processed
    Beginner = 0,
    /// Intermediate: 11-50 wastes processed
    Intermediate = 1,
    /// Advanced: 51-200 wastes processed
    Advanced = 2,
    /// Expert: 201+ wastes processed
    Expert = 3,
}

impl CertificationLevel {
    /// Validates if the level is a valid CertificationLevel variant
    pub fn is_valid(level: u32) -> bool {
        matches!(level, 0..=3)
    }

    /// Converts a u32 to a CertificationLevel
    pub fn from_u32(value: u32) -> Option<Self> {
        match value {
            0 => Some(CertificationLevel::Beginner),
            1 => Some(CertificationLevel::Intermediate),
            2 => Some(CertificationLevel::Advanced),
            3 => Some(CertificationLevel::Expert),
            _ => None,
        }
    }

    /// Converts the CertificationLevel to u32
    pub fn to_u32(&self) -> u32 {
        *self as u32
    }

    /// Returns the string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            CertificationLevel::Beginner => "BEGINNER",
            CertificationLevel::Intermediate => "INTERMEDIATE",
            CertificationLevel::Advanced => "ADVANCED",
            CertificationLevel::Expert => "EXPERT",
        }
    }

    /// Determines certification level based on waste count
    pub fn from_waste_count(waste_count: u128) -> Self {
        match waste_count {
            0..=10 => CertificationLevel::Beginner,
            11..=50 => CertificationLevel::Intermediate,
            51..=200 => CertificationLevel::Advanced,
            _ => CertificationLevel::Expert,
        }
    }

    /// Gets the minimum waste count for this level
    pub fn min_waste_count(&self) -> u128 {
        match self {
            CertificationLevel::Beginner => 0,
            CertificationLevel::Intermediate => 11,
            CertificationLevel::Advanced => 51,
            CertificationLevel::Expert => 201,
        }
    }

    /// Gets the reward multiplier for this certification level
    pub fn reward_multiplier(&self) -> u64 {
        match self {
            CertificationLevel::Beginner => 100,     // 1.0x
            CertificationLevel::Intermediate => 110, // 1.1x
            CertificationLevel::Advanced => 125,     // 1.25x
            CertificationLevel::Expert => 150,       // 1.5x
        }
    }
}

/// Tracks recycling statistics for a participant.
///
/// # Storage layout optimization (issue #758)
/// Fields are ordered by descending alignment: `Address` (variable), then `u128`
/// (16-byte aligned), then `u64` (8-byte aligned), then `u32` (4-byte aligned).
/// This grouping avoids alignment-padding words in the XDR encoding, reducing the
/// ledger-entry size and the read/write cost for every call that touches stats.
///
/// u128 group  : carbon_credits_earned, total_impact_score,
///               total_processing_costs, recycled_weight
/// u64  group  : submissions, weights, type-counts, grade-counts
/// u32  group  : recycling_rate
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecyclingStats {
    /// Participant address
    pub participant: Address,
    // ── u128 fields (largest alignment first) ──────────────────────────────
    /// Total carbon credits earned (grams of CO2 equivalent)
    pub carbon_credits_earned: u128,
    /// Total environmental impact score
    pub total_impact_score: u128,
    /// Total processing costs incurred (in smallest token unit)
    pub total_processing_costs: u128,
    /// Total weight of recycled waste (for rate calculation)
    pub recycled_weight: u128,
    // ── u64 fields ─────────────────────────────────────────────────────────
    /// Total number of materials submitted
    pub total_submissions: u64,
    /// Total number of verified materials
    pub verified_submissions: u64,
    /// Total weight of all materials in grams
    pub total_weight: u64,
    /// Total reward points earned
    pub total_points: u64,
    /// Number of materials by waste type
    pub paper_count: u64,
    pub pet_plastic_count: u64,
    pub plastic_count: u64,
    pub metal_count: u64,
    pub glass_count: u64,
    pub organic_count: u64,
    pub electronic_count: u64,
    /// Number of wastes graded by this participant per grade
    pub grade_a_count: u64,
    pub grade_b_count: u64,
    pub grade_c_count: u64,
    pub grade_d_count: u64,
    // ── u32 fields ─────────────────────────────────────────────────────────
    /// Recycling rate in basis points (e.g. 9500 = 95.00%)
    /// Calculated as (recycled_weight / total_weight) * 10000
    pub recycling_rate: u32,
}

impl RecyclingStats {
    /// Creates a new RecyclingStats instance
    pub fn new(participant: Address) -> Self {
        Self {
            participant,
            total_submissions: 0,
            verified_submissions: 0,
            total_weight: 0,
            total_points: 0,
            carbon_credits_earned: 0,
            total_impact_score: 0,
            paper_count: 0,
            pet_plastic_count: 0,
            plastic_count: 0,
            metal_count: 0,
            glass_count: 0,
            organic_count: 0,
            electronic_count: 0,
            grade_a_count: 0,
            grade_b_count: 0,
            grade_c_count: 0,
            grade_d_count: 0,
            total_processing_costs: 0,
            recycling_rate: 0,
            recycled_weight: 0,
        }
    }

    /// Records a grading action by this participant
    pub fn record_grade(&mut self, grade: WasteGrade) {
        match grade {
            WasteGrade::A => self.grade_a_count += 1,
            WasteGrade::B => self.grade_b_count += 1,
            WasteGrade::C => self.grade_c_count += 1,
            WasteGrade::D => self.grade_d_count += 1,
        }
    }

    /// Records a new material submission
    pub fn record_submission(&mut self, material: &Material) {
        self.total_submissions = self
            .total_submissions
            .checked_add(1)
            .expect("Overflow in total submissions");
        self.total_weight = self
            .total_weight
            .checked_add(material.weight)
            .expect("Overflow in total weight");

        // Update waste type count
        let count = match material.waste_type {
            WasteType::Paper => &mut self.paper_count,
            WasteType::PetPlastic => &mut self.pet_plastic_count,
            WasteType::Plastic => &mut self.plastic_count,
            WasteType::Metal => &mut self.metal_count,
            WasteType::Glass => &mut self.glass_count,
        };
        *count = count.checked_add(1).expect("Overflow in waste type count");
        match material.waste_type {
            WasteType::Paper => self.paper_count += 1,
            WasteType::PetPlastic => self.pet_plastic_count += 1,
            WasteType::Plastic => self.plastic_count += 1,
            WasteType::Metal => self.metal_count += 1,
            WasteType::Glass => self.glass_count += 1,
            WasteType::Organic => self.organic_count += 1,
            WasteType::Electronic => self.electronic_count += 1,
        }
    }

    /// Records a material verification and updates carbon credits
    pub fn record_verification(&mut self, material: &Material) {
        if material.verified {
            self.verified_submissions = self
                .verified_submissions
                .checked_add(1)
                .expect("Overflow in verified submissions");
            self.total_points = self
                .total_points
                .checked_add(material.calculate_reward_points())
                .expect("Overflow in total points");
            self.verified_submissions += 1;
            self.total_points += material.calculate_reward_points();
            self.carbon_credits_earned += calculate_carbon_credits(material.waste_type, material.weight as u128);
        }
    }

    /// Calculates the verification rate (percentage)
    pub fn verification_rate(&self) -> u64 {
        if self.total_submissions == 0 {
            0
        } else {
            self.verified_submissions
                .checked_mul(100)
                .expect("Overflow in verification rate")
                / self.total_submissions
        }
    }

    /// Gets the most submitted waste type
    pub fn most_submitted_type(&self) -> Option<WasteType> {
        let counts = [
            (WasteType::Paper, self.paper_count),
            (WasteType::PetPlastic, self.pet_plastic_count),
            (WasteType::Plastic, self.plastic_count),
            (WasteType::Metal, self.metal_count),
            (WasteType::Glass, self.glass_count),
            (WasteType::Organic, self.organic_count),
            (WasteType::Electronic, self.electronic_count),
        ];

        counts
            .iter()
            .max_by_key(|(_, count)| count)
            .filter(|(_, count)| *count > 0)
            .map(|(waste_type, _)| *waste_type)
    }

    /// Calculates average weight per submission
    pub fn average_weight(&self) -> u64 {
        if self.total_submissions == 0 {
            0
        } else {
            self.total_weight / self.total_submissions
        }
    }

    /// Checks if participant is an active recycler (10+ submissions)
    pub fn is_active_recycler(&self) -> bool {
        self.total_submissions >= 10
    }

    /// Checks if participant is a verified contributor (80%+ verification rate)
    pub fn is_verified_contributor(&self) -> bool {
        self.verification_rate() >= 80
    }

    /// Recalculates and stores the recycling rate in basis points.
    /// rate = (recycled_weight / total_weight) * 10000
    pub fn update_recycling_rate(&mut self) {
        self.recycling_rate = if self.total_weight == 0 {
            0
        } else {
            ((self.recycled_weight as u128 * 10_000) / self.total_weight as u128) as u32
        };
    }
}

// ========== Leaderboard Types ==========

/// A single leaderboard entry
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LeaderboardEntry {
    pub participant: Address,
    pub score: u128,
    pub rank: u32,
}

// ========== Participant Tier System (issue #696) ==========

/// Participant tier based on total waste processed, reputation, and consistency.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ParticipantTier {
    /// Less than 100,000 grams processed
    Bronze = 0,
    /// 100,000 to 499,999 grams processed
    Silver = 1,
    /// 500,000 to 1,999,999 grams processed
    Gold = 2,
    /// 2,000,000+ grams processed
    Platinum = 3,
}

impl ParticipantTier {
    /// Calculates the participant tier based on total waste processed (in grams).
    pub fn from_total_waste(total_waste: u128) -> Self {
        if total_waste >= 2_000_000 {
            ParticipantTier::Platinum
        } else if total_waste >= 500_000 {
            ParticipantTier::Gold
        } else if total_waste >= 100_000 {
            ParticipantTier::Silver
        } else {
            ParticipantTier::Bronze
        }
    }

    /// Gets the reward multiplier for this tier (scaled by 100).
    pub fn reward_multiplier(&self) -> u64 {
        match self {
            ParticipantTier::Bronze => 100,   // 1.0x
            ParticipantTier::Silver => 110,   // 1.1x
            ParticipantTier::Gold => 125,     // 1.25x
            ParticipantTier::Platinum => 150, // 1.5x
        }
    }
}

// ========== Reputation System Types (issue #551) ==========

/// Tiered reputation badge based on a participant's score.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReputationBadge {
    /// score < 100
    None = 0,
    /// 100 <= score < 500
    Bronze = 1,
    /// 500 <= score < 2000
    Silver = 2,
    /// 2000 <= score < 5000
    Gold = 3,
    /// score >= 5000
    Platinum = 4,
}

impl ReputationBadge {
    /// Map a reputation score to its corresponding badge tier.
    pub fn from_score(score: i128) -> Self {
        if score >= 5000 {
            ReputationBadge::Platinum
        } else if score >= 2000 {
            ReputationBadge::Gold
        } else if score >= 500 {
            ReputationBadge::Silver
        } else if score >= 100 {
            ReputationBadge::Bronze
        } else {
            ReputationBadge::None
        }
    }
}
