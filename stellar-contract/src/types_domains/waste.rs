use super::*;

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
        match value {
            0 => Some(WasteType::Paper),
            1 => Some(WasteType::PetPlastic),
            2 => Some(WasteType::Plastic),
            3 => Some(WasteType::Metal),
            4 => Some(WasteType::Glass),
            5 => Some(WasteType::Organic),
            6 => Some(WasteType::Electronic),
            _ => None,
        }
    }

    /// Converts the WasteType to u32
    pub fn to_u32(&self) -> u32 {
        *self as u32
    }

    /// Returns the string representation of the waste type
    pub fn as_str(&self) -> &'static str {
        match self {
            WasteType::Paper => "PAPER",
            WasteType::PetPlastic => "PETPLASTIC",
            WasteType::Plastic => "PLASTIC",
            WasteType::Metal => "METAL",
            WasteType::Glass => "GLASS",
            WasteType::Organic => "ORGANIC",
            WasteType::Electronic => "ELECTRONIC",
        }
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

        self.latitude >= -max_lat && self.latitude <= max_lat && self.longitude >= -max_lon && self.longitude <= max_lon
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
    pub fn new(waste_id: u128, waste_type: WasteType, weight: u128, current_owner: Address) -> Self {
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
    pub fn new(batch_id: u64, created_by: Address, created_at: u64, env: &soroban_sdk::Env) -> Self {
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
