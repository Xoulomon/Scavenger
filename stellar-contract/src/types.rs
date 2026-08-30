use soroban_sdk::{contracttype, Address, String, Symbol};

/// Represents an incentive offered by a manufacturer to encourage recycling
/// Represents a transfer record in the recycling system
/// This struct is fully compatible with Soroban storage and implements
/// deterministic serialization for safe storage and retrieval
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferRecord {
    /// Unique identifier for the transfer
    pub id: u64,
    /// Address of the sender
    pub from: Address,
    /// Address of the recipient
    pub to: Address,
    /// Type of item being transferred
    pub item_type: TransferItemType,
    /// Identifier of the item being transferred
    pub item_id: u64,
    /// Amount or quantity being transferred
    pub amount: u64,
    /// Timestamp when the transfer occurred
    pub timestamp: u64,
    /// Status of the transfer
    pub status: TransferStatus,
    /// Optional note or description
    pub note: String,
}

/// Represents the type of item being transferred
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TransferItemType {
    /// Material/Waste transfer
    Material = 0,
    /// Token transfer
    Token = 1,
    /// Incentive transfer
    Incentive = 2,
    /// Ownership transfer
    Ownership = 3,
}

/// Represents the status of a transfer
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TransferStatus {
    /// Transfer is pending
    Pending = 0,
    /// Transfer is in progress
    InProgress = 1,
    /// Transfer completed successfully
    Completed = 2,
    /// Transfer failed
    Failed = 3,
    /// Transfer was cancelled
    Cancelled = 4,
}

impl TransferItemType {
    /// Validates if the value is a valid TransferItemType variant
    pub fn is_valid(value: u32) -> bool {
        matches!(value, 0..=3)
    }

    /// Converts a u32 to a TransferItemType
    pub fn from_u32(value: u32) -> Option<Self> {
        crate::type_utils::transfer_item_type_from_u32(value)
    }

    /// Converts the TransferItemType to u32
    pub fn to_u32(&self) -> u32 {
        crate::type_utils::transfer_item_type_to_u32(*self)
    }

    /// Returns the string representation
    pub fn as_str(&self) -> &'static str {
        crate::type_utils::transfer_item_type_as_str(*self)
    }
}

impl TransferStatus {
    /// Validates if the value is a valid TransferStatus variant
    pub fn is_valid(value: u32) -> bool {
        matches!(value, 0..=4)
    }

    /// Converts a u32 to a TransferStatus
    pub fn from_u32(value: u32) -> Option<Self> {
        crate::type_utils::transfer_status_from_u32(value)
    }

    /// Converts the TransferStatus to u32
    pub fn to_u32(&self) -> u32 {
        crate::type_utils::transfer_status_to_u32(*self)
    }

    /// Returns the string representation
    pub fn as_str(&self) -> &'static str {
        crate::type_utils::transfer_status_as_str(*self)
    }

    /// Checks if the status is final (cannot be changed)
    pub fn is_final(&self) -> bool {
        matches!(
            self,
            TransferStatus::Completed | TransferStatus::Failed | TransferStatus::Cancelled
        )
    }

    /// Checks if the status is active (can still be modified)
    pub fn is_active(&self) -> bool {
        matches!(self, TransferStatus::Pending | TransferStatus::InProgress)
    }
}

#[allow(dead_code)]
impl TransferRecord {
    /// Creates a new TransferRecord with Pending status
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: u64,
        from: Address,
        to: Address,
        item_type: TransferItemType,
        item_id: u64,
        amount: u64,
        timestamp: u64,
        note: String,
    ) -> Self {
        Self {
            id,
            from,
            to,
            item_type,
            item_id,
            amount,
            timestamp,
            status: TransferStatus::Pending,
            note,
        }
    }

    /// Updates the status of the transfer
    /// Returns true if updated, false if status is final
    pub fn update_status(&mut self, new_status: TransferStatus) -> bool {
        if self.status.is_final() {
            return false;
        }
        self.status = new_status;
        true
    }

    /// Validates the transfer record
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.amount == 0 {
            return Err("Amount must be greater than zero");
        }
        if self.from == self.to {
            return Err("Sender and recipient cannot be the same");
        }
        Ok(())
    }

    /// Checks if the transfer is complete
    pub fn is_complete(&self) -> bool {
        self.status == TransferStatus::Completed
    }

    /// Checks if the transfer can be modified
    pub fn is_modifiable(&self) -> bool {
        self.status.is_active()
    }
}

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
        // Convert grams to kg and multiply by reward points
        (weight_grams / 1000)
            .checked_mul(self.reward_points)
            .expect("Overflow in reward calculation")
        let weight_kg = weight_grams / 1000;
        if self.tiers.is_empty() {
            return weight_kg * self.reward_points;
        }
        // Find the matching tier (tiers are sorted by min_weight_kg ascending)
        for i in 0..self.tiers.len() {
            let tier = self.tiers.get(i).unwrap();
            let in_lower = weight_kg >= tier.min_weight_kg;
            let in_upper = tier.max_weight_kg == 0 || weight_kg < tier.max_weight_kg;
            if in_lower && in_upper {
                return weight_kg * tier.reward_points;
            }
        }
        // No tier matched — fall back to flat rate
        weight_kg * self.reward_points
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
        crate::type_utils::participant_role_from_u32(value)
    }

    /// Converts the ParticipantRole to u32
    pub fn to_u32(&self) -> u32 {
        crate::type_utils::participant_role_to_u32(*self)
    }

    /// Returns the string representation of the role
    pub fn as_str(&self) -> &'static str {
        crate::type_utils::participant_role_as_str(*self)
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
        crate::type_utils::certification_level_from_u32(value)
    }

    /// Converts the CertificationLevel to u32
    pub fn to_u32(&self) -> u32 {
        crate::type_utils::certification_level_to_u32(*self)
    }

    /// Returns the string representation
    pub fn as_str(&self) -> &'static str {
        crate::type_utils::certification_level_as_str(*self)
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
            CertificationLevel::Beginner => 100, // 1.0x
            CertificationLevel::Intermediate => 110, // 1.1x
            CertificationLevel::Advanced => 125, // 1.25x
            CertificationLevel::Expert => 150, // 1.5x
        }
    }
}

/// Represents the type of waste material in the recycling ecosystem
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WasteType {
    /// Paper waste - newspapers, cardboard, office paper
    Paper = 0,
    /// PET plastic - polyethylene terephthalate bottles and containers
    PetPlastic = 1,
    /// General plastic waste - various plastic types
    Plastic = 2,
    /// Metal waste - aluminum, steel, copper
    Metal = 3,
    /// Glass waste - bottles, jars, containers
    Glass = 4,
    /// Organic waste - food scraps, yard waste
    Organic = 5,
    /// Electronic waste - computers, phones, batteries
    Electronic = 6,
}

impl WasteType {
    /// Validates if the value is a valid WasteType variant
    pub fn is_valid(value: u32) -> bool {
        matches!(value, 0..=6)
    }

    /// Converts a u32 to a WasteType
    /// Returns None if the value is invalid
    pub fn from_u32(value: u32) -> Option<Self> {
        crate::type_utils::waste_type_from_u32(value)
    }

    /// Converts the WasteType to u32
    pub fn to_u32(&self) -> u32 {
        crate::type_utils::waste_type_to_u32(*self)
    }

    /// Returns the string representation of the waste type
    pub fn as_str(&self) -> &'static str {
        crate::type_utils::waste_type_as_str(*self)
    }

    /// Returns the carbon credit rate in milligrams of CO2 equivalent per gram of waste.
    /// Rates (gCO2e/g): Plastic=2.5, Paper=1.8, Metal=3.2, Glass=0.8, Organic=0.5, Electronic=4.0
    /// Stored as fixed-point * 1000 to avoid floats: e.g. 2500 = 2.5 gCO2e/g
    pub fn carbon_credit_rate_milli(&self) -> u128 {
        match self {
            WasteType::Paper => 1800,
            WasteType::PetPlastic => 2500,
            WasteType::Plastic => 2500,
            WasteType::Metal => 3200,
            WasteType::Glass => 800,
            WasteType::Organic => 500,
            WasteType::Electronic => 4000,
        }
    }

    /// Returns the impact score multiplier per gram for this waste type
    pub fn impact_score_multiplier(&self) -> u128 {
        match self {
            WasteType::Paper => 10,
            WasteType::PetPlastic => 30,
            WasteType::Plastic => 25,
            WasteType::Metal => 40,
            WasteType::Glass => 15,
            WasteType::Organic => 5,
            WasteType::Electronic => 50,
        }
    }

    /// Checks if the waste type is recyclable plastic
    pub fn is_plastic(&self) -> bool {
        matches!(self, WasteType::PetPlastic | WasteType::Plastic)
    }

    /// Checks if the waste type is biodegradable
    pub fn is_biodegradable(&self) -> bool {
        matches!(self, WasteType::Paper | WasteType::Organic)
    }

    /// Checks if the waste type is infinitely recyclable
    pub fn is_infinitely_recyclable(&self) -> bool {
        matches!(self, WasteType::Metal | WasteType::Glass)
    }
}

impl core::fmt::Display for WasteType {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Represents a recyclable material submission in the system
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Material {
    /// Unique identifier for the material
    pub id: u64,
    /// Type of waste material
    pub waste_type: WasteType,
    /// Weight of the material in grams
    pub weight: u64,
    /// Address of the participant who submitted the material
    pub submitter: Address,
    /// Timestamp when the material was submitted
    pub submitted_at: u64,
    /// Whether the material has been verified
    pub verified: bool,
    /// Optional description of the material
    pub description: String,
}

/// Environmental impact score for a waste item
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ImpactScore {
    /// Total impact score (based on waste type and weight)
    pub score: u128,
    /// Timestamp when score was calculated
    pub calculated_at: u64,
}

/// History of impact scores for a participant
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ImpactHistoryEntry {
    /// Waste ID
    pub waste_id: u128,
    /// Impact score for this waste
    pub score: u128,
    /// Timestamp when the score was recorded
    pub recorded_at: u64,
}

impl Material {
    /// Creates a new Material instance
    pub fn new(
        id: u64,
        waste_type: WasteType,
        weight: u64,
        submitter: Address,
        submitted_at: u64,
        description: String,
    ) -> Self {
        Self {
            id,
            waste_type,
            weight,
            submitter,
            submitted_at,
            verified: false,
            description,
        }
    }

    /// Marks the material as verified
    pub fn verify(&mut self) {
        self.verified = true;
    }

    /// Checks if the material meets minimum weight requirement (100g)
    pub fn meets_minimum_weight(&self) -> bool {
        self.weight >= 100
    }

    /// Calculates reward points based on waste type and weight
    /// Different waste types have different point multipliers
    pub fn calculate_reward_points(&self) -> u64 {
        let multiplier = match self.waste_type {
            WasteType::Paper => 1,
            WasteType::PetPlastic => 3,
            WasteType::Plastic => 2,
            WasteType::Metal => 5,
            WasteType::Glass => 2,
            WasteType::Organic => 1,
            WasteType::Electronic => 6,
        };

        // Points = (weight in kg) * multiplier * 10
        (self.weight / 1000)
            .checked_mul(multiplier)
            .and_then(|v| v.checked_mul(10))
            .expect("Overflow in reward points calculation")
    }
}

/// Processing stages a waste item moves through in the supply chain.
/// Stages must progress forward only (Collected → Sorted → Processed → Recycled → Manufactured).
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProcessingStatus {
    Collected = 0,
    Sorted = 1,
    Processed = 2,
    Recycled = 3,
    Manufactured = 4,
}

impl ProcessingStatus {
    pub fn to_u32(self) -> u32 {
        self as u32
    }

    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(ProcessingStatus::Collected),
            1 => Some(ProcessingStatus::Sorted),
            2 => Some(ProcessingStatus::Processed),
            3 => Some(ProcessingStatus::Recycled),
            4 => Some(ProcessingStatus::Manufactured),
            _ => None,
        }
    }
}

/// A single entry in a waste item's processing history.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProcessingRecord {
    pub status: ProcessingStatus,
    pub timestamp: u64,
    pub updated_by: Address,
}

/// Represents a single material component in a waste item's composition.
/// Percentages across all entries for a waste item must sum to 100.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MaterialComposition {
    /// The type of material in this component
    pub material_type: WasteType,
    /// Percentage of this material (0-100, all entries must sum to 100)
    pub percentage: u32,
}

/// A single contamination report submitted by a participant for a waste item.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContaminationReport {
    /// ID of the waste item being reported
    pub waste_id: u128,
    /// Address of the participant who submitted the report
    pub reporter: Address,
    /// Contamination level 0-100 as assessed by the reporter
    pub level: u32,
    /// Human-readable reason for the report
    pub reason: String,
    /// Ledger timestamp when the report was submitted
    pub reported_at: u64,
}

/// Soroban-compatible optional WasteType (Option<WasteType> cannot be used directly in contracttype).
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OptionalWasteType {
    None = 0,
    Paper = 1,
    PetPlastic = 2,
    Plastic = 3,
    Metal = 4,
    Glass = 5,
    Organic = 6,
    Electronic = 7,
}

impl OptionalWasteType {
    /// Returns true if this matches any waste type, or the specific type given.
    pub fn matches(&self, wt: WasteType) -> bool {
        match self {
            OptionalWasteType::None => true,
            OptionalWasteType::Paper => wt == WasteType::Paper,
            OptionalWasteType::PetPlastic => wt == WasteType::PetPlastic,
            OptionalWasteType::Plastic => wt == WasteType::Plastic,
            OptionalWasteType::Metal => wt == WasteType::Metal,
            OptionalWasteType::Glass => wt == WasteType::Glass,
            OptionalWasteType::Organic => wt == WasteType::Organic,
            OptionalWasteType::Electronic => wt == WasteType::Electronic,
        }
    }
}

/// Represents a participant's recycling goal
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecyclingGoal {
    /// Target weight in grams
    pub target_weight: u128,
    /// Target completion timestamp (Unix seconds)
    pub target_date: u64,
    /// Waste type this goal applies to (None = any type)
    pub waste_type: OptionalWasteType,
    /// Weight already recycled toward this goal
    pub current_weight: u128,
    /// Whether this goal has been achieved
    pub achieved: bool,
    /// Timestamp when goal was created
    pub created_at: u64,
}

/// Represents a waste item in the recycling system
/// This is the main struct that tracks waste throughout its lifecycle
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Waste {
    /// Unique identifier for the waste item
    pub waste_id: u128,
    /// Type of waste material
    pub waste_type: WasteType,
    /// Weight of the waste in grams
    pub weight: u128,
    /// Current owner of the waste
    pub current_owner: Address,
    /// Latitude coordinate (scaled by 1e6 for precision)
    pub latitude: i128,
    /// Longitude coordinate (scaled by 1e6 for precision)
    pub longitude: i128,
    /// Timestamp when the waste was recycled (0 if not yet recycled)
    pub recycled_timestamp: u64,
    /// Whether the waste is currently active in the system
    pub is_active: bool,
    /// Whether the waste is frozen (e.g. due to an open dispute) and cannot be transferred
    pub is_frozen: bool,
    /// Whether the waste has been confirmed/verified
    pub is_confirmed: bool,
    /// Address of the confirmer/verifier
    pub confirmer: Address,
    /// Quality grade assigned by a collector or manufacturer
    pub grade: WasteGrade,
    /// Category tags for filtering (max 10, each max 20 chars, lowercase)
    pub tags: soroban_sdk::Vec<soroban_sdk::String>,
    /// Optional IPFS CID for the primary image (starts with "Qm" or "bafy")
    pub image_hash: Option<soroban_sdk::String>,
    /// Supporting document hashes (max 5, each a valid IPFS CID)
    pub document_hashes: soroban_sdk::Vec<soroban_sdk::String>,
    /// Optional expiry timestamp (0 = no expiry)
    pub expires_at: u64,
    /// Reserved by address (for reservation system)
    pub reserved_by: Option<Address>,
    /// Reserved until timestamp
    pub reserved_until: Option<u64>,
    /// Whether the waste is contaminated
    pub is_contaminated: bool,
    /// Contamination level (0-100)
    pub contamination_level: u32,
    /// Contamination reason
    pub contamination_reason: soroban_sdk::String,
    /// Current processing status
    pub processing_status: ProcessingStatus,
    /// Processing history
    pub processing_history: soroban_sdk::Vec<ProcessingRecord>,
    /// Substitution history
    pub substitution_history: soroban_sdk::Vec<SubstitutionRecord>,
    /// Unique tracking code for QR codes
    pub tracking_code: soroban_sdk::String,
    /// Processing cost in tokens (set by owner)
    pub processing_cost: u128,
    /// Material composition breakdown (percentages summing to 100)
    pub composition: soroban_sdk::Vec<MaterialComposition>,
    /// Environmental impact score for this waste item
    pub impact_score: u128,
}

impl Waste {
    /// Creates a new Waste instance with all fields
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        env: &soroban_sdk::Env,
        waste_id: u128,
        waste_type: WasteType,
        weight: u128,
        current_owner: Address,
        latitude: i128,
        longitude: i128,
        recycled_timestamp: u64,
        is_active: bool,
        is_confirmed: bool,
        confirmer: Address,
        expires_at: u64,
    ) -> Self {
        let initial_record = ProcessingRecord {
            status: ProcessingStatus::Collected,
            timestamp: env.ledger().timestamp(),
            updated_by: current_owner.clone(),
        };
        let mut history = soroban_sdk::Vec::new(env);
        history.push_back(initial_record);

        let tracking_code = soroban_sdk::String::from_str(env, "WS-TRACK");

        let impact_score = calculate_impact_score(waste_type, weight);

        Self {
            waste_id,
            waste_type,
            weight,
            current_owner,
            latitude,
            longitude,
            recycled_timestamp,
            is_active,
            is_frozen: false,
            is_confirmed,
            confirmer,
            grade: WasteGrade::C,
            tags: soroban_sdk::Vec::new(env),
            image_hash: None,
            document_hashes: soroban_sdk::Vec::new(env),
            expires_at,
            reserved_by: None,
            reserved_until: None,
            is_contaminated: false,
            contamination_level: 0,
            contamination_reason: soroban_sdk::String::from_str(env, ""),
            processing_status: ProcessingStatus::Collected,
            processing_history: history,
            substitution_history: soroban_sdk::Vec::new(env),
            tracking_code,
            processing_cost: 0,
            composition: soroban_sdk::Vec::new(env),
            impact_score,
        }
    }
    pub fn is_expired(&self, now: u64) -> bool {
        self.expires_at != 0 && now >= self.expires_at
    }

    /// Validates that the waste has valid coordinates
    pub fn has_valid_coordinates(&self) -> bool {
        let max_lat = 90_000_000i128;
        let max_lon = 180_000_000i128;

        self.latitude >= -max_lat
            && self.latitude <= max_lat
            && self.longitude >= -max_lon
            && self.longitude <= max_lon
    }

    /// Checks if the waste has been recycled
    pub fn is_recycled(&self) -> bool {
        self.recycled_timestamp > 0
    }

    /// Checks if the waste meets minimum weight requirement (100g)
    pub fn meets_minimum_weight(&self) -> bool {
        self.weight >= 100
    }

    /// Marks the waste as recycled with the given timestamp
    pub fn mark_recycled(&mut self, timestamp: u64) {
        self.recycled_timestamp = timestamp;
    }

    /// Confirms the waste with the given confirmer
    pub fn confirm(&mut self, confirmer: Address) {
        self.is_confirmed = true;
        self.confirmer = confirmer;
    }

    /// Resets the confirmation status of the waste
    pub fn reset_confirmation(&mut self) {
        self.is_confirmed = false;
        self.confirmer = self.current_owner.clone();
    }

    /// Deactivates the waste
    pub fn deactivate(&mut self) {
        self.is_active = false;
    }

    /// Transfers ownership to a new owner
    pub fn transfer_to(&mut self, new_owner: Address) {
        self.current_owner = new_owner;
    }

    /// Updates the location of the waste
    pub fn update_location(&mut self, latitude: i128, longitude: i128) {
        self.latitude = latitude;
        self.longitude = longitude;
    }
}

/// Represents an auction for waste materials
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Auction {
    /// Unique identifier for the auction
    pub id: u64,
    /// ID of the waste being auctioned
    pub waste_id: u128,
    /// Address of the auction creator (waste owner)
    pub creator: Address,
    /// Starting price in tokens
    pub start_price: u128,
    /// Current highest bid
    pub current_bid: u128,
    /// Address of the current highest bidder
    pub bidder: Option<Address>,
    /// Timestamp when the auction ends
    pub end_time: u64,
    /// Whether the auction is active
    pub is_active: bool,
    /// List of all bidders for refund purposes
    pub bidders: soroban_sdk::Vec<Address>,
}

impl Auction {
    /// Creates a new auction
    pub fn new(
        env: &soroban_sdk::Env,
        id: u64,
        waste_id: u128,
        creator: Address,
        start_price: u128,
        duration: u64,
    ) -> Self {
        let end_time = env.ledger().timestamp() + duration;
        Self {
            id,
            waste_id,
            creator,
            start_price,
            current_bid: start_price,
            bidder: None,
            end_time,
            is_active: true,
            bidders: soroban_sdk::Vec::new(env),
        }
    }

    /// Checks if the auction has ended
    pub fn is_ended(&self, now: u64) -> bool {
        now >= self.end_time
    }

    /// Checks if a bid is valid (higher than current by at least 5%)
    pub fn is_valid_bid(&self, bid_amount: u128) -> bool {
        if bid_amount <= self.current_bid {
            return false;
        }
        let min_increment = (self.current_bid * 105) / 100;
        bid_amount >= min_increment
    }

    /// Places a bid on the auction
    pub fn place_bid(&mut self, bidder: Address, amount: u128) {
        if !self.bidders.contains(&bidder) {
            self.bidders.push_back(bidder.clone());
        }
        self.bidder = Some(bidder);
        self.current_bid = amount;
    }

    /// Ends the auction
    pub fn end(&mut self) {
        self.is_active = false;
    }
}

/// A listing of carbon credits offered for sale on the marketplace.
///
/// Credits listed here are escrowed: they are subtracted from the seller's
/// `RecyclingStats.carbon_credits_earned` when the listing is created and
/// returned (on cancel) or transferred to the buyer (on purchase).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CarbonListing {
    pub id: u64,
    pub seller: Address,
    /// Amount of carbon credits (grams of CO2 equivalent) on offer.
    pub amount: u128,
    /// Price per credit in the smallest token unit of the configured token.
    pub price_per_credit: i128,
    pub is_active: bool,
    pub created_at: u64,
}

/// Represents a period for compliance reporting
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReportPeriod {
    pub start_timestamp: u64,
    pub end_timestamp: u64,
}

/// Status of regulatory validation
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ComplianceStatus {
    Pending = 0,
    Compliant = 1,
    NonCompliant = 2,
    Exempt = 3,
}

/// Regulatory requirement validation result
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RegulatoryValidation {
    pub requirement_id: String,
    pub status: ComplianceStatus,
    pub notes: String,
}

/// Represents a compliance report for environmental regulations
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ComplianceReport {
    pub id: u64,
    pub period: ReportPeriod,
    pub total_waste_tracked: u128,
    pub waste_by_type: soroban_sdk::Vec<(WasteType, u128)>,
    pub total_carbon_credits: u128,
    pub validations: soroban_sdk::Vec<RegulatoryValidation>,
    pub generated_at: u64,
    pub version: u32,
    pub is_finalized: bool,
}

/// Status of a multi-signature transfer approval
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TransferApprovalStatus {
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Expired = 3,
}

/// Represents a multi-signature approval for high-value transfers
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferApproval {
    pub waste_id: u128,
    pub from: Address,
    pub to: Address,
    pub amount: u128,
    pub approvers: soroban_sdk::Vec<Address>,
    pub required_approvals: u32,
    pub status: TransferApprovalStatus,
    pub created_at: u64,
    pub expires_at: u64,
}

/// Represents a substitution of one waste item for another
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubstitutionRecord {
    pub original_id: u128,
    pub substitute_id: u128,
    pub approver: Address,
    pub reason: String,
    pub timestamp: u64,
}

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

/// Transfer record for waste movement across the supply chain.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WasteTransfer {
    pub waste_id: u128,
    pub from: Address,
    pub to: Address,
    pub transferred_at: u64,
    pub latitude: i128,
    pub longitude: i128,
    pub note: Symbol,
}

impl WasteTransfer {
    pub fn new(
        waste_id: u128,
        from: Address,
        to: Address,
        transferred_at: u64,
        latitude: i128,
        longitude: i128,
        note: Symbol,
    ) -> Self {
        Self {
            waste_id,
            from,
            to,
            transferred_at,
            latitude,
            longitude,
            note,
        }
    }
}

/// Tracks recycling statistics for a participant
/// Builder pattern for constructing Waste instances
/// Provides a fluent API for creating waste with optional fields
#[allow(dead_code)]
pub struct WasteBuilder {
    waste_id: u128,
    waste_type: WasteType,
    weight: u128,
    current_owner: Address,
    latitude: i128,
    longitude: i128,
    recycled_timestamp: u64,
    is_active: bool,
    is_confirmed: bool,
    confirmer: Option<Address>,
    grade: WasteGrade,
}

#[allow(dead_code)]
impl WasteBuilder {
    /// Creates a new WasteBuilder with required fields
    pub fn new(
        waste_id: u128,
        waste_type: WasteType,
        weight: u128,
        current_owner: Address,
    ) -> Self {
        Self {
            waste_id,
            waste_type,
            weight,
            current_owner: current_owner.clone(),
            latitude: 0,
            longitude: 0,
            recycled_timestamp: 0,
            is_active: true,
            is_confirmed: false,
            confirmer: Some(current_owner),
            grade: WasteGrade::C,
        }
    }

    /// Sets the location coordinates
    pub fn location(mut self, latitude: i128, longitude: i128) -> Self {
        self.latitude = latitude;
        self.longitude = longitude;
        self
    }

    /// Sets the recycled timestamp
    pub fn recycled_at(mut self, timestamp: u64) -> Self {
        self.recycled_timestamp = timestamp;
        self
    }

    /// Sets the active status
    pub fn active(mut self, is_active: bool) -> Self {
        self.is_active = is_active;
        self
    }

    /// Sets the confirmed status and confirmer
    pub fn confirmed(mut self, confirmer: Address) -> Self {
        self.is_confirmed = true;
        self.confirmer = Some(confirmer);
        self
    }

    /// Sets the confirmer address
    pub fn confirmer(mut self, confirmer: Address) -> Self {
        self.confirmer = Some(confirmer);
        self
    }

    /// Sets the waste grade
    pub fn grade(mut self, grade: WasteGrade) -> Self {
        self.grade = grade;
        self
    }

    /// Builds the Waste instance
    pub fn build(self, env: &soroban_sdk::Env) -> Waste {
        let confirmer = self.confirmer.unwrap_or_else(|| self.current_owner.clone());
        let initial_record = ProcessingRecord {
            status: ProcessingStatus::Collected,
            timestamp: env.ledger().timestamp(),
            updated_by: self.current_owner.clone(),
        };
        let mut history = soroban_sdk::Vec::new(env);
        history.push_back(initial_record);
        Waste {
            waste_id: self.waste_id,
            waste_type: self.waste_type,
            weight: self.weight,
            current_owner: self.current_owner,
            latitude: self.latitude,
            longitude: self.longitude,
            recycled_timestamp: self.recycled_timestamp,
            is_active: self.is_active,
            is_frozen: false,
            is_confirmed: self.is_confirmed,
            confirmer,
            grade: self.grade,
            tags: soroban_sdk::Vec::new(env),
            image_hash: None,
            document_hashes: soroban_sdk::Vec::new(env),
            expires_at: 0,
            reserved_by: None,
            reserved_until: None,
            is_contaminated: false,
            contamination_level: 0,
            contamination_reason: soroban_sdk::String::from_str(env, ""),
            processing_status: ProcessingStatus::Collected,
            processing_history: history,
            substitution_history: soroban_sdk::Vec::new(env),
            tracking_code: soroban_sdk::String::from_str(env, "WS-TRACK"),
            processing_cost: 0,
            composition: soroban_sdk::Vec::new(env),
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

/// Calculate carbon credits (grams of CO2 equivalent) for a given waste type and weight in grams.
/// Formula: credits = weight_grams * rate_milli / 1000
pub fn calculate_carbon_credits(waste_type: WasteType, weight_grams: u128) -> u128 {
    weight_grams * waste_type.carbon_credit_rate_milli() / 1000
}

/// Calculate environmental impact score for a given waste type and weight in grams.
/// Formula: score = weight_grams * impact_score_multiplier
pub fn calculate_impact_score(waste_type: WasteType, weight_grams: u128) -> u128 {
    weight_grams * waste_type.impact_score_multiplier()
}

#[cfg(test)]
mod recycling_stats_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_new_stats() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let stats = RecyclingStats::new(participant.clone());

        assert_eq!(stats.participant, participant);
        assert_eq!(stats.total_submissions, 0);
        assert_eq!(stats.verified_submissions, 0);
        assert_eq!(stats.total_weight, 0);
        assert_eq!(stats.total_points, 0);
    }

    #[test]
    fn test_record_submission() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut stats = RecyclingStats::new(participant.clone());
        let material = Material::new(1, WasteType::Paper, 5000, participant, 0, description);

        stats.record_submission(&material);

        assert_eq!(stats.total_submissions, 1);
        assert_eq!(stats.total_weight, 5000);
        assert_eq!(stats.paper_count, 1);
    }

    #[test]
    fn test_record_verification() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut stats = RecyclingStats::new(participant.clone());
        let mut material = Material::new(1, WasteType::Metal, 5000, participant, 0, description);

        material.verify();
        stats.record_verification(&material);

        assert_eq!(stats.verified_submissions, 1);
        assert_eq!(stats.total_points, 250); // 5kg * 5 * 10
    }

    #[test]
    fn test_verification_rate() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        stats.total_submissions = 10;
        stats.verified_submissions = 8;

        assert_eq!(stats.verification_rate(), 80);
    }

    #[test]
    fn test_most_submitted_type() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        stats.paper_count = 5;
        stats.plastic_count = 10;
        stats.metal_count = 3;

        assert_eq!(stats.most_submitted_type(), Some(WasteType::Plastic));
    }

    #[test]
    fn test_average_weight() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        stats.total_submissions = 5;
        stats.total_weight = 10000;

        assert_eq!(stats.average_weight(), 2000);
    }

    #[test]
    fn test_is_active_recycler() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        assert!(!stats.is_active_recycler());

        stats.total_submissions = 10;
        assert!(stats.is_active_recycler());
    }

    #[test]
    fn test_is_verified_contributor() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        stats.total_submissions = 10;
        stats.verified_submissions = 8;

        assert!(stats.is_verified_contributor());
    }

    #[test]
    fn test_stats_storage() {
        let env = soroban_sdk::Env::default();
        let _contract_id = env.register_contract(None, crate::ScavengerContract);
        let participant = Address::generate(&env);

        let stats = RecyclingStats::new(participant.clone());

        // RecyclingStats can be stored (validated through contract tests)
        assert_eq!(stats.total_submissions, 0);
    }

    #[test]
    #[should_panic(expected = "Overflow in total submissions")]
    fn test_record_submission_overflows_at_u64_max_total_submissions() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut stats = RecyclingStats::new(participant.clone());
        stats.total_submissions = u64::MAX;
        let material = Material::new(1, WasteType::Paper, 1, participant, 0, description);

        stats.record_submission(&material);
    }

    #[test]
    #[should_panic(expected = "Overflow in total weight")]
    fn test_record_submission_overflows_at_u64_max_total_weight() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut stats = RecyclingStats::new(participant.clone());
        stats.total_weight = u64::MAX;
        let material = Material::new(1, WasteType::Paper, 1, participant, 0, description);

        stats.record_submission(&material);
    }

    #[test]
    #[should_panic(expected = "Overflow in total points")]
    fn test_record_verification_overflows_at_u64_max_total_points() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut stats = RecyclingStats::new(participant.clone());
        stats.total_points = u64::MAX;
        let mut material = Material::new(1, WasteType::Metal, 1000, participant, 0, description);
        material.verify();

        stats.record_verification(&material);
    }

    #[test]
    #[should_panic(expected = "Overflow in verification rate")]
    fn test_verification_rate_overflows_at_extreme_verified_submissions() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        stats.total_submissions = 1;
        stats.verified_submissions = u64::MAX;

        stats.verification_rate();
    }
}

#[cfg(test)]
mod material_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_material_creation() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Plastic bottles");

        let material = Material::new(
            1,
            WasteType::PetPlastic,
            5000,
            submitter.clone(),
            1234567890,
            description.clone(),
        );

        assert_eq!(material.id, 1);
        assert_eq!(material.waste_type, WasteType::PetPlastic);
        assert_eq!(material.weight, 5000);
        assert_eq!(material.submitter, submitter);
        assert_eq!(material.submitted_at, 1234567890);
        assert!(!material.verified);
        assert_eq!(material.description, description);
    }

    #[test]
    fn test_material_verify() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut material = Material::new(
            1,
            WasteType::Paper,
            1000,
            submitter,
            1234567890,
            description,
        );

        assert!(!material.verified);
        material.verify();
        assert!(material.verified);
    }

    #[test]
    fn test_meets_minimum_weight() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let material_below = Material::new(
            1,
            WasteType::Paper,
            50,
            submitter.clone(),
            1234567890,
            description.clone(),
        );
        assert!(!material_below.meets_minimum_weight());

        let material_exact = Material::new(
            2,
            WasteType::Paper,
            100,
            submitter.clone(),
            1234567890,
            description.clone(),
        );
        assert!(material_exact.meets_minimum_weight());

        let material_above =
            Material::new(3, WasteType::Paper, 500, submitter, 1234567890, description);
        assert!(material_above.meets_minimum_weight());
    }

    #[test]
    fn test_calculate_reward_points() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        // Paper: 5kg * 1 * 10 = 50 points
        let paper = Material::new(
            1,
            WasteType::Paper,
            5000,
            submitter.clone(),
            0,
            description.clone(),
        );
        assert_eq!(paper.calculate_reward_points(), 50);

        // PetPlastic: 5kg * 3 * 10 = 150 points
        let pet = Material::new(
            2,
            WasteType::PetPlastic,
            5000,
            submitter.clone(),
            0,
            description.clone(),
        );
        assert_eq!(pet.calculate_reward_points(), 150);

        // Plastic: 5kg * 2 * 10 = 100 points
        let plastic = Material::new(
            3,
            WasteType::Plastic,
            5000,
            submitter.clone(),
            0,
            description.clone(),
        );
        assert_eq!(plastic.calculate_reward_points(), 100);

        // Metal: 5kg * 5 * 10 = 250 points
        let metal = Material::new(
            4,
            WasteType::Metal,
            5000,
            submitter.clone(),
            0,
            description.clone(),
        );
        assert_eq!(metal.calculate_reward_points(), 250);

        // Glass: 5kg * 2 * 10 = 100 points
        let glass = Material::new(5, WasteType::Glass, 5000, submitter, 0, description);
        assert_eq!(glass.calculate_reward_points(), 100);
    }

    #[test]
    fn test_material_storage_compatibility() {
        let env = soroban_sdk::Env::default();
        let _contract_id = env.register_contract(None, crate::ScavengerContract);
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Storage test");

        let material = Material::new(
            1,
            WasteType::Metal,
            3000,
            submitter,
            1234567890,
            description,
        );

        // Material can be stored in Soroban storage (validated through contract tests)
        assert_eq!(material.id, 1);
        assert_eq!(material.waste_type, WasteType::Metal);
        assert_eq!(material.weight, 3000);
    }

    #[test]
    fn test_calculate_reward_points_at_u64_max_weight_does_not_overflow() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        // weight/1000 shrinks u64::MAX enough that * multiplier(<=5) * 10 cannot overflow u64.
        let material = Material::new(1, WasteType::Metal, u64::MAX, submitter, 0, description);
        assert_eq!(material.calculate_reward_points(), (u64::MAX / 1000) * 50);
    }
}

#[cfg(test)]
mod incentive_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    #[should_panic(expected = "Overflow in reward calculation")]
    fn test_calculate_reward_overflows_at_extreme_reward_points() {
        let env = soroban_sdk::Env::default();
        let rewarder = Address::generate(&env);

        let incentive = Incentive::new(1, rewarder, WasteType::Metal, u64::MAX, u64::MAX, 0);
        // 5000g -> 5kg, 5 * u64::MAX overflows u64
        incentive.calculate_reward(5000);
    }

    #[test]
    fn test_claim_reward_respects_remaining_budget() {
        let env = soroban_sdk::Env::default();
        let rewarder = Address::generate(&env);

        let mut incentive = Incentive::new(1, rewarder, WasteType::Metal, 10, 45, 0);
        // 5kg * 10 = 50 > 45 remaining budget -> rejected
        assert_eq!(incentive.claim_reward(5000), None);
        assert_eq!(incentive.remaining_budget, 45);

        // 4kg * 10 = 40 <= 45 remaining budget -> accepted, deactivates only when exhausted
        assert_eq!(incentive.claim_reward(4000), Some(40));
        assert_eq!(incentive.remaining_budget, 5);
        assert!(incentive.active);
    }

    #[test]
    fn test_claim_reward_deactivates_on_exact_budget_exhaustion() {
        let env = soroban_sdk::Env::default();
        let rewarder = Address::generate(&env);

        let mut incentive = Incentive::new(1, rewarder, WasteType::Metal, 10, 50, 0);
        assert_eq!(incentive.claim_reward(5000), Some(50));
        assert_eq!(incentive.remaining_budget, 0);
        assert!(!incentive.active);
    }
}

#[cfg(test)]
mod waste_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    fn make_waste(env: &Env, owner: Address, latitude: i128, longitude: i128) -> Waste {
        Waste::new(1, WasteType::Metal, 5000, owner.clone(), latitude, longitude, 0, true, false, owner)
    }

    #[test]
    fn test_new_sets_all_fields() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let confirmer = Address::generate(&env);
        let waste = Waste::new(7, WasteType::Glass, 250, owner.clone(), 1, 2, 99, false, true, confirmer.clone());

        assert_eq!(waste.waste_id, 7);
        assert_eq!(waste.waste_type, WasteType::Glass);
        assert_eq!(waste.weight, 250);
        assert_eq!(waste.current_owner, owner);
        assert_eq!(waste.latitude, 1);
        assert_eq!(waste.longitude, 2);
        assert_eq!(waste.recycled_timestamp, 99);
        assert!(!waste.is_active);
        assert!(waste.is_confirmed);
        assert_eq!(waste.confirmer, confirmer);
    }

    #[test]
    fn test_has_valid_coordinates() {
        let env = Env::default();
        let owner = Address::generate(&env);

        assert!(make_waste(&env, owner.clone(), 0, 0).has_valid_coordinates());
        assert!(make_waste(&env, owner.clone(), 90_000_000, 180_000_000).has_valid_coordinates());
        assert!(make_waste(&env, owner.clone(), -90_000_000, -180_000_000).has_valid_coordinates());
        assert!(!make_waste(&env, owner.clone(), 90_000_001, 0).has_valid_coordinates());
        assert!(!make_waste(&env, owner, 0, 180_000_001).has_valid_coordinates());
    }

    #[test]
    fn test_is_recycled() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let mut waste = make_waste(&env, owner, 0, 0);

        assert!(!waste.is_recycled());
        waste.mark_recycled(12345);
        assert!(waste.is_recycled());
        assert_eq!(waste.recycled_timestamp, 12345);
    }

    #[test]
    fn test_waste_meets_minimum_weight() {
        let env = Env::default();
        let owner = Address::generate(&env);

        let mut light = make_waste(&env, owner.clone(), 0, 0);
        light.weight = 99;
        assert!(!light.meets_minimum_weight());

        let mut exact = make_waste(&env, owner, 0, 0);
        exact.weight = 100;
        assert!(exact.meets_minimum_weight());
    }

    #[test]
    fn test_update_location() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let mut waste = make_waste(&env, owner, 0, 0);

        waste.update_location(45_000_000, -93_000_000);
        assert_eq!(waste.latitude, 45_000_000);
        assert_eq!(waste.longitude, -93_000_000);
    }
}

#[cfg(test)]
mod transfer_record_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_transfer_item_type_round_trip() {
        for (variant, value) in [
            (TransferItemType::Material, 0u32),
            (TransferItemType::Token, 1),
            (TransferItemType::Incentive, 2),
            (TransferItemType::Ownership, 3),
        ] {
            assert!(TransferItemType::is_valid(value));
            assert_eq!(TransferItemType::from_u32(value), Some(variant));
            assert_eq!(variant.to_u32(), value);
        }
        assert!(!TransferItemType::is_valid(4));
        assert_eq!(TransferItemType::from_u32(4), None);
    }

    #[test]
    fn test_transfer_status_round_trip_and_state() {
        for (variant, value, is_final, is_active) in [
            (TransferStatus::Pending, 0u32, false, true),
            (TransferStatus::InProgress, 1, false, true),
            (TransferStatus::Completed, 2, true, false),
            (TransferStatus::Failed, 3, true, false),
            (TransferStatus::Cancelled, 4, true, false),
        ] {
            assert!(TransferStatus::is_valid(value));
            assert_eq!(TransferStatus::from_u32(value), Some(variant));
            assert_eq!(variant.to_u32(), value);
            assert_eq!(variant.is_final(), is_final);
            assert_eq!(variant.is_active(), is_active);
        }
        assert!(!TransferStatus::is_valid(5));
        assert_eq!(TransferStatus::from_u32(5), None);
    }

    fn make_record(env: &Env, from: Address, to: Address) -> TransferRecord {
        TransferRecord::new(
            1,
            from,
            to,
            TransferItemType::Material,
            42,
            5000,
            0,
            String::from_str(env, "note"),
        )
    }

    #[test]
    fn test_new_starts_pending() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let record = make_record(&env, from, to);

        assert_eq!(record.status, TransferStatus::Pending);
        assert!(!record.is_complete());
        assert!(record.is_modifiable());
    }

    #[test]
    fn test_update_status_succeeds_while_not_final() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let mut record = make_record(&env, from, to);

        assert!(record.update_status(TransferStatus::InProgress));
        assert_eq!(record.status, TransferStatus::InProgress);

        assert!(record.update_status(TransferStatus::Completed));
        assert_eq!(record.status, TransferStatus::Completed);
        assert!(record.is_complete());
        assert!(!record.is_modifiable());
    }

    #[test]
    fn test_update_status_rejected_once_final() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let mut record = make_record(&env, from, to);

        assert!(record.update_status(TransferStatus::Cancelled));
        // Status is final; further updates must be rejected and leave state unchanged.
        assert!(!record.update_status(TransferStatus::Pending));
        assert_eq!(record.status, TransferStatus::Cancelled);
    }

    #[test]
    fn test_validate_rejects_zero_amount() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let mut record = make_record(&env, from, to);
        record.amount = 0;

        assert_eq!(record.validate(), Err("Amount must be greater than zero"));
    }

    #[test]
    fn test_validate_rejects_same_sender_and_recipient() {
        let env = Env::default();
        let addr = Address::generate(&env);
        let record = make_record(&env, addr.clone(), addr);

        assert_eq!(record.validate(), Err("Sender and recipient cannot be the same"));
    }

    #[test]
    fn test_validate_accepts_well_formed_record() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let record = make_record(&env, from, to);

        assert_eq!(record.validate(), Ok(()));
    }
}

#[cfg(test)]
mod waste_type_tests {
    use super::*;

    #[test]
    fn test_waste_type_values() {
        assert_eq!(WasteType::Paper as u32, 0);
        assert_eq!(WasteType::PetPlastic as u32, 1);
        assert_eq!(WasteType::Plastic as u32, 2);
        assert_eq!(WasteType::Metal as u32, 3);
        assert_eq!(WasteType::Glass as u32, 4);
        assert_eq!(WasteType::Organic as u32, 5);
        assert_eq!(WasteType::Electronic as u32, 6);
    }

    #[test]
    fn test_waste_type_is_valid() {
        assert!(WasteType::is_valid(0));
        assert!(WasteType::is_valid(1));
        assert!(WasteType::is_valid(2));
        assert!(WasteType::is_valid(3));
        assert!(WasteType::is_valid(4));
        assert!(WasteType::is_valid(5));
        assert!(WasteType::is_valid(6));
        assert!(!WasteType::is_valid(7));
        assert!(!WasteType::is_valid(999));
    }

    #[test]
    fn test_waste_type_from_u32() {
        assert_eq!(WasteType::from_u32(0), Some(WasteType::Paper));
        assert_eq!(WasteType::from_u32(1), Some(WasteType::PetPlastic));
        assert_eq!(WasteType::from_u32(2), Some(WasteType::Plastic));
        assert_eq!(WasteType::from_u32(3), Some(WasteType::Metal));
        assert_eq!(WasteType::from_u32(4), Some(WasteType::Glass));
        assert_eq!(WasteType::from_u32(5), Some(WasteType::Organic));
        assert_eq!(WasteType::from_u32(6), Some(WasteType::Electronic));
        assert_eq!(WasteType::from_u32(7), None);
        assert_eq!(WasteType::from_u32(999), None);
    }

    #[test]
    fn test_waste_type_to_u32() {
        assert_eq!(WasteType::Paper.to_u32(), 0);
        assert_eq!(WasteType::PetPlastic.to_u32(), 1);
        assert_eq!(WasteType::Plastic.to_u32(), 2);
        assert_eq!(WasteType::Metal.to_u32(), 3);
        assert_eq!(WasteType::Glass.to_u32(), 4);
        assert_eq!(WasteType::Organic.to_u32(), 5);
        assert_eq!(WasteType::Electronic.to_u32(), 6);
    }

    #[test]
    fn test_waste_type_as_str() {
        assert_eq!(WasteType::Paper.as_str(), "PAPER");
        assert_eq!(WasteType::PetPlastic.as_str(), "PETPLASTIC");
        assert_eq!(WasteType::Plastic.as_str(), "PLASTIC");
        assert_eq!(WasteType::Metal.as_str(), "METAL");
        assert_eq!(WasteType::Glass.as_str(), "GLASS");
        assert_eq!(WasteType::Organic.as_str(), "ORGANIC");
        assert_eq!(WasteType::Electronic.as_str(), "ELECTRONIC");
    }

    #[test]
    fn test_waste_type_display() {
        assert_eq!(WasteType::Paper.as_str(), "PAPER");
        assert_eq!(WasteType::PetPlastic.as_str(), "PETPLASTIC");
        assert_eq!(WasteType::Plastic.as_str(), "PLASTIC");
        assert_eq!(WasteType::Metal.as_str(), "METAL");
        assert_eq!(WasteType::Glass.as_str(), "GLASS");
        assert_eq!(WasteType::Organic.as_str(), "ORGANIC");
        assert_eq!(WasteType::Electronic.as_str(), "ELECTRONIC");
    }

    #[test]
    fn test_waste_type_is_plastic() {
        assert!(!WasteType::Paper.is_plastic());
        assert!(WasteType::PetPlastic.is_plastic());
        assert!(WasteType::Plastic.is_plastic());
        assert!(!WasteType::Metal.is_plastic());
        assert!(!WasteType::Glass.is_plastic());
    }

    #[test]
    fn test_waste_type_is_biodegradable() {
        assert!(WasteType::Paper.is_biodegradable());
        assert!(!WasteType::PetPlastic.is_biodegradable());
        assert!(!WasteType::Plastic.is_biodegradable());
        assert!(!WasteType::Metal.is_biodegradable());
        assert!(!WasteType::Glass.is_biodegradable());
        assert!(WasteType::Organic.is_biodegradable());
        assert!(!WasteType::Electronic.is_biodegradable());
    }

    #[test]
    fn test_waste_type_is_infinitely_recyclable() {
        assert!(!WasteType::Paper.is_infinitely_recyclable());
        assert!(!WasteType::PetPlastic.is_infinitely_recyclable());
        assert!(!WasteType::Plastic.is_infinitely_recyclable());
        assert!(WasteType::Metal.is_infinitely_recyclable());
        assert!(WasteType::Glass.is_infinitely_recyclable());
    }

    #[test]
    fn test_waste_type_clone_and_copy() {
        let waste1 = WasteType::Paper;
        let waste2 = waste1;
        assert_eq!(waste1, waste2);
    }

    #[test]
    fn test_waste_type_equality() {
        assert_eq!(WasteType::Paper, WasteType::Paper);
        assert_ne!(WasteType::Paper, WasteType::Plastic);
        assert_ne!(WasteType::Metal, WasteType::Glass);
    }

    #[test]
    fn test_all_waste_types() {
        let types = [
            WasteType::Paper,
            WasteType::PetPlastic,
            WasteType::Plastic,
            WasteType::Metal,
            WasteType::Glass,
            WasteType::Organic,
            WasteType::Electronic,
        ];

        for (i, waste_type) in types.iter().enumerate() {
            assert_eq!(waste_type.to_u32(), i as u32);
            assert_eq!(WasteType::from_u32(i as u32), Some(*waste_type));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_role_values() {
        assert_eq!(ParticipantRole::Recycler as u32, 0);
        assert_eq!(ParticipantRole::Collector as u32, 1);
        assert_eq!(ParticipantRole::Manufacturer as u32, 2);
    }

    #[test]
    fn test_is_valid() {
        assert!(ParticipantRole::is_valid(0));
        assert!(ParticipantRole::is_valid(1));
        assert!(ParticipantRole::is_valid(2));
        assert!(!ParticipantRole::is_valid(3));
        assert!(!ParticipantRole::is_valid(999));
    }

    #[test]
    fn test_from_u32() {
        assert_eq!(
            ParticipantRole::from_u32(0),
            Some(ParticipantRole::Recycler)
        );
        assert_eq!(
            ParticipantRole::from_u32(1),
            Some(ParticipantRole::Collector)
        );
        assert_eq!(
            ParticipantRole::from_u32(2),
            Some(ParticipantRole::Manufacturer)
        );
        assert_eq!(ParticipantRole::from_u32(3), None);
        assert_eq!(ParticipantRole::from_u32(999), None);
    }

    #[test]
    fn test_to_u32() {
        assert_eq!(ParticipantRole::Recycler.to_u32(), 0);
        assert_eq!(ParticipantRole::Collector.to_u32(), 1);
        assert_eq!(ParticipantRole::Manufacturer.to_u32(), 2);
    }

    #[test]
    fn test_as_str() {
        assert_eq!(ParticipantRole::Recycler.as_str(), "RECYCLER");
        assert_eq!(ParticipantRole::Collector.as_str(), "COLLECTOR");
        assert_eq!(ParticipantRole::Manufacturer.as_str(), "MANUFACTURER");
    }

    #[test]
    fn test_can_collect_materials() {
        assert!(ParticipantRole::Recycler.can_collect_materials());
        assert!(ParticipantRole::Collector.can_collect_materials());
        assert!(!ParticipantRole::Manufacturer.can_collect_materials());
    }

    #[test]
    fn test_can_manufacture() {
        assert!(!ParticipantRole::Recycler.can_manufacture());
        assert!(!ParticipantRole::Collector.can_manufacture());
        assert!(ParticipantRole::Manufacturer.can_manufacture());
    }

    #[test]
    fn test_can_process_recyclables() {
        assert!(ParticipantRole::Recycler.can_process_recyclables());
        assert!(!ParticipantRole::Collector.can_process_recyclables());
        assert!(!ParticipantRole::Manufacturer.can_process_recyclables());
    }

    #[test]
    fn test_clone_and_copy() {
        let role1 = ParticipantRole::Recycler;
        let role2 = role1;
        assert_eq!(role1, role2);
    }

    #[test]
    fn test_equality() {
        assert_eq!(ParticipantRole::Recycler, ParticipantRole::Recycler);
        assert_ne!(ParticipantRole::Recycler, ParticipantRole::Collector);
        assert_ne!(ParticipantRole::Collector, ParticipantRole::Manufacturer);
    }
}

// ─── Grading rules per waste type ───────────────────────────────────────────
// These methods are defined after WasteGrade to allow forward-reference use.

impl WasteType {
    /// Returns the minimum acceptable quality grade for this waste type.
    ///
    /// Grading rules are based on material complexity, safety requirements,
    /// and downstream processing needs:
    ///
    /// | Waste Type  | Min Grade | Rationale |
    /// |-------------|-----------|-----------|
    /// | Electronic  | B         | Safety and data-destruction compliance |
    /// | Metal       | C         | Contamination tolerance moderate |
    /// | Glass       | C         | Breakage and contaminant-free needed |
    /// | PetPlastic  | C         | Food-contact reuse standards |
    /// | Paper       | D         | Broad recyclability, lower quality OK |
    /// | Plastic     | D         | General plastic stream tolerance |
    /// | Organic     | D         | Composting accepts poor-condition material |
    pub fn min_acceptable_grade(&self) -> WasteGrade {
        match self {
            WasteType::Electronic => WasteGrade::B,
            WasteType::Metal => WasteGrade::C,
            WasteType::Glass => WasteGrade::C,
            WasteType::PetPlastic => WasteGrade::C,
            WasteType::Paper => WasteGrade::D,
            WasteType::Plastic => WasteGrade::D,
            WasteType::Organic => WasteGrade::D,
        }
    }

    /// Checks whether the given grade meets this waste type's minimum quality bar.
    ///
    /// Returns `true` if `grade` is at least as good as the minimum acceptable
    /// grade (i.e. the numeric discriminant of `grade` is ≤ that of the minimum,
    /// since A=0 is the best and D=3 is the worst).
    pub fn grade_is_acceptable(&self, grade: WasteGrade) -> bool {
        (grade as u32) <= (self.min_acceptable_grade() as u32)
    }
}

/// Quality grade for a waste item
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WasteGrade {
    /// Grade A — excellent quality, 1.5x reward multiplier (scaled: 150)
    A = 0,
    /// Grade B — good quality, 1.2x reward multiplier (scaled: 120)
    B = 1,
    /// Grade C — average quality, 1.0x reward multiplier (scaled: 100)
    C = 2,
    /// Grade D — poor quality, 0.7x reward multiplier (scaled: 70)
    D = 3,
}

impl WasteGrade {
    /// Returns the reward multiplier scaled by 100 (e.g. 150 = 1.5x).
    pub fn multiplier_pct(&self) -> u64 {
        match self {
            WasteGrade::A => 150,
            WasteGrade::B => 120,
            WasteGrade::C => 100,
            WasteGrade::D => 70,
        }
    }

    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(WasteGrade::A),
            1 => Some(WasteGrade::B),
            2 => Some(WasteGrade::C),
            3 => Some(WasteGrade::D),
            _ => None,
        }
    }

    pub fn is_valid(v: u32) -> bool {
        v <= 3
    }
}

/// Immutable audit record for a single grading event
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GradeRecord {
    pub waste_id: u128,
    pub grade: WasteGrade,
    pub grader: Address,
    pub graded_at: u64,
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

/// A single entry in a composition analysis result
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompositionEntry {
    pub material_type: WasteType,
    pub avg_percentage: u32,
}

/// Records when a waste item is approaching its expiration time
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExpirationWarning {
    pub waste_id: u128,
    pub expires_at: u64,
    pub warning_type: soroban_sdk::Symbol,
    pub warned_at: u64,
}

/// Records transfer path validation data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferValidationRecord {
    pub waste_id: u128,
    pub from: Address,
    pub to: Address,
    pub valid: bool,
    pub reason: soroban_sdk::String,
    pub validated_at: u64,
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

// ========== Transfer Approval Workflow Types ==========

/// Status of a pending transfer
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PendingTransferStatus {
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Expired = 3,
}

/// A pending waste transfer awaiting recipient approval
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingTransfer {
    pub id: u64,
    pub waste_id: u128,
    pub from: Address,
    pub to: Address,
    pub initiated_at: u64,
    /// Expiry timestamp (initiated_at + 86400 seconds)
    pub expires_at: u64,
    pub status: PendingTransferStatus,
    pub latitude: i128,
    pub longitude: i128,
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

// ========== Leaderboard Types ==========

/// A single leaderboard entry
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LeaderboardEntry {
    pub participant: Address,
    pub score: u128,
    pub rank: u32,
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

// ============================================================================
// Issue #654: Waste Quality Scoring
// ============================================================================

/// Quality score for waste materials (0-100)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QualityScore {
    /// Score value (0-100)
    pub score: u32,
    /// Timestamp when score was calculated
    pub calculated_at: u64,
    /// Address of the scorer
    pub scorer: Address,
}

impl QualityScore {
    /// Creates a new quality score
    pub fn new(score: u32, calculated_at: u64, scorer: Address) -> Self {
        Self {
            score: score.min(100),
            calculated_at,
            scorer,
        }
    }

    /// Gets quality tier based on score
    pub fn tier(&self) -> &'static str {
        match self.score {
            90..=100 => "EXCELLENT",
            75..=89 => "GOOD",
            60..=74 => "ACCEPTABLE",
            _ => "POOR",
        }
    }

    /// Gets reward multiplier based on score (scaled by 100)
    pub fn reward_multiplier(&self) -> u64 {
        match self.score {
            90..=100 => 150, // 1.5x
            75..=89 => 125,  // 1.25x
            60..=74 => 100,  // 1.0x
            _ => 70,         // 0.7x
        }
    }
}

// ============================================================================
// Issue #655: Waste Location Tracking
// ============================================================================

/// Location record for waste tracking
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LocationRecord {
    /// Latitude (scaled by 1e6)
    pub latitude: i128,
    /// Longitude (scaled by 1e6)
    pub longitude: i128,
    /// Timestamp of location update
    pub timestamp: u64,
    /// Address that updated the location
    pub updated_by: Address,
}

impl LocationRecord {
    /// Creates a new location record
    pub fn new(latitude: i128, longitude: i128, timestamp: u64, updated_by: Address) -> Self {
        Self {
            latitude,
            longitude,
            timestamp,
            updated_by,
        }
    }
}

// ============================================================================
// Issue #656: Waste Batch Tracking
// ============================================================================

/// Batch of waste items for efficient tracking
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WasteBatch {
    /// Unique batch identifier
    pub batch_id: u64,
    /// IDs of waste items in this batch
    pub waste_ids: soroban_sdk::Vec<u128>,
    /// Total weight of all items in batch (grams)
    pub total_weight: u128,
    /// Batch creator
    pub created_by: Address,
    /// Timestamp when batch was created
    pub created_at: u64,
    /// Current batch status
    pub status: BatchStatus,
}

/// Status of a waste batch
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BatchStatus {
    /// Batch is being assembled
    Pending = 0,
    /// Batch is ready for processing
    Ready = 1,
    /// Batch is being processed
    Processing = 2,
    /// Batch processing completed
    Completed = 3,
    /// Batch was cancelled
    Cancelled = 4,
}

impl BatchStatus {
    /// Converts u32 to BatchStatus
    pub fn from_u32(value: u32) -> Option<Self> {
        match value {
            0 => Some(BatchStatus::Pending),
            1 => Some(BatchStatus::Ready),
            2 => Some(BatchStatus::Processing),
            3 => Some(BatchStatus::Completed),
            4 => Some(BatchStatus::Cancelled),
            _ => None,
        }
    }

    /// Converts BatchStatus to u32
    pub fn to_u32(&self) -> u32 {
        *self as u32
    }

    /// Returns string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            BatchStatus::Pending => "PENDING",
            BatchStatus::Ready => "READY",
            BatchStatus::Processing => "PROCESSING",
            BatchStatus::Completed => "COMPLETED",
            BatchStatus::Cancelled => "CANCELLED",
        }
    }
}

impl WasteBatch {
    /// Creates a new waste batch
    pub fn new(
        batch_id: u64,
        created_by: Address,
        created_at: u64,
        env: &soroban_sdk::Env,
    ) -> Self {
        Self {
            batch_id,
            waste_ids: soroban_sdk::Vec::new(env),
            total_weight: 0,
            created_by,
            created_at,
            status: BatchStatus::Pending,
        }
    }

    /// Adds a waste item to the batch
    pub fn add_waste(&mut self, waste_id: u128, weight: u128) {
        self.waste_ids.push_back(waste_id);
        self.total_weight += weight;
    }

    /// Marks batch as ready
    pub fn mark_ready(&mut self) {
        if self.status == BatchStatus::Pending {
            self.status = BatchStatus::Ready;
        }
    }

    /// Marks batch as processing
    pub fn mark_processing(&mut self) {
        if self.status == BatchStatus::Ready {
            self.status = BatchStatus::Processing;
        }
    }

    /// Marks batch as completed
    pub fn mark_completed(&mut self) {
        if self.status == BatchStatus::Processing {
            self.status = BatchStatus::Completed;
        }
    }
}

// ============================================================================
// Issue #657: Waste Certification Levels
// ============================================================================

/// Certification for waste quality and processing
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WasteCertification {
    /// Waste item ID
    pub waste_id: u128,
    /// Certification level
    pub level: CertificationLevel,
    /// Certifier address
    pub certifier: Address,
    /// Timestamp of certification
    pub certified_at: u64,
    /// Expiry timestamp (0 = no expiry)
    pub expires_at: u64,
    /// Certification notes
    pub notes: soroban_sdk::String,
}

impl WasteCertification {
    /// Creates a new waste certification
    pub fn new(
        waste_id: u128,
        level: CertificationLevel,
        certifier: Address,
        certified_at: u64,
        expires_at: u64,
        notes: soroban_sdk::String,
    ) -> Self {
        Self {
            waste_id,
            level,
            certifier,
            certified_at,
            expires_at,
            notes,
        }
    }

    /// Checks if certification is still valid
    pub fn is_valid(&self, current_time: u64) -> bool {
        self.expires_at == 0 || current_time < self.expires_at
    }
}

// ============ RBAC Types (#704) ============

/// Granular permission types for contract functions.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PermissionType {
    /// Can verify and grade waste
    Verifier = 0,
    /// Can read audit logs and access reports
    Auditor = 1,
    /// Can manage participants and config (sub-admin)
    Admin = 2,
    /// Can create and update incentives on behalf of others
    IncentiveManager = 3,
}

impl PermissionType {
    /// Convert from u32, returning None for unknown variants.
    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(PermissionType::Verifier),
            1 => Some(PermissionType::Auditor),
            2 => Some(PermissionType::Admin),
            3 => Some(PermissionType::IncentiveManager),
            _ => None,
        }
    }
}

/// A single entry in the permission audit trail.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PermissionAuditEntry {
    /// Address whose permission changed
    pub subject: Address,
    /// The permission type
    pub permission: PermissionType,
    /// true = granted, false = revoked
    pub granted: bool,
    /// Who performed the change (admin)
    pub changed_by: Address,
    /// Ledger timestamp of the change
    pub timestamp: u64,
}

// ============ Reconciliation Types (#706) ============

/// Outcome of a waste reconciliation operation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReconciliationRecord {
    /// The waste item that was reconciled
    pub waste_id: u128,
    /// Original weight before reconciliation
    pub original_weight: u128,
    /// Reported (claimed) weight from submitter
    pub reported_weight: u128,
    /// Adjusted weight after reconciliation
    pub adjusted_weight: u128,
    /// Who triggered the reconciliation
    pub reconciled_by: Address,
    /// Timestamp of reconciliation
    pub timestamp: u64,
    /// Human-readable reason / rule applied
    pub reason: String,
}
