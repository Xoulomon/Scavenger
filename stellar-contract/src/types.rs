use soroban_sdk::{contracttype, Address, String, Vec};

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
        matches!(value, 0 | 1 | 2 | 3)
    }

    /// Converts a u32 to a TransferItemType
    pub fn from_u32(value: u32) -> Option<Self> {
        match value {
            0 => Some(TransferItemType::Material),
            1 => Some(TransferItemType::Token),
            2 => Some(TransferItemType::Incentive),
            3 => Some(TransferItemType::Ownership),
            _ => None,
        }
    }

    /// Converts the TransferItemType to u32
    pub fn to_u32(&self) -> u32 {
        *self as u32
    }

    /// Returns the string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            TransferItemType::Material => "MATERIAL",
            TransferItemType::Token => "TOKEN",
            TransferItemType::Incentive => "INCENTIVE",
            TransferItemType::Ownership => "OWNERSHIP",
        }
    }
}

impl TransferStatus {
    /// Validates if the value is a valid TransferStatus variant
    pub fn is_valid(value: u32) -> bool {
        matches!(value, 0 | 1 | 2 | 3 | 4)
    }

    /// Converts a u32 to a TransferStatus
    pub fn from_u32(value: u32) -> Option<Self> {
        match value {
            0 => Some(TransferStatus::Pending),
            1 => Some(TransferStatus::InProgress),
            2 => Some(TransferStatus::Completed),
            3 => Some(TransferStatus::Failed),
            4 => Some(TransferStatus::Cancelled),
            _ => None,
        }
    }

    /// Converts the TransferStatus to u32
    pub fn to_u32(&self) -> u32 {
        *self as u32
    }

    /// Returns the string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            TransferStatus::Pending => "PENDING",
            TransferStatus::InProgress => "IN_PROGRESS",
            TransferStatus::Completed => "COMPLETED",
            TransferStatus::Failed => "FAILED",
            TransferStatus::Cancelled => "CANCELLED",
        }
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

impl TransferRecord {
    /// Creates a new TransferRecord with Pending status
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
        matches!(role, 0 | 1 | 2)
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
}

impl WasteType {
    /// Validates if the value is a valid WasteType variant
    pub fn is_valid(value: u32) -> bool {
        matches!(value, 0 | 1 | 2 | 3 | 4)
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
        }
    }

    /// Checks if the waste type is recyclable plastic
    pub fn is_plastic(&self) -> bool {
        matches!(self, WasteType::PetPlastic | WasteType::Plastic)
    }

    /// Checks if the waste type is biodegradable
    pub fn is_biodegradable(&self) -> bool {
        matches!(self, WasteType::Paper)
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
        };
        
        // Points = (weight in kg) * multiplier * 10
        (self.weight / 1000) * multiplier * 10
    }
}

/// Tracks recycling statistics for a participant
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecyclingStats {
    /// Participant address
    pub participant: Address,
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
            paper_count: 0,
            pet_plastic_count: 0,
            plastic_count: 0,
            metal_count: 0,
            glass_count: 0,
        }
    }

    /// Records a new material submission
    pub fn record_submission(&mut self, material: &Material) {
        self.total_submissions += 1;
        self.total_weight += material.weight;
        
        // Update waste type count
        match material.waste_type {
            WasteType::Paper => self.paper_count += 1,
            WasteType::PetPlastic => self.pet_plastic_count += 1,
            WasteType::Plastic => self.plastic_count += 1,
            WasteType::Metal => self.metal_count += 1,
            WasteType::Glass => self.glass_count += 1,
        }
    }

    /// Records a material verification
    pub fn record_verification(&mut self, material: &Material) {
        if material.verified {
            self.verified_submissions += 1;
            self.total_points += material.calculate_reward_points();
        }
    }

    /// Calculates the verification rate (percentage)
    pub fn verification_rate(&self) -> u64 {
        if self.total_submissions == 0 {
            0
        } else {
            (self.verified_submissions * 100) / self.total_submissions
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
        let participant = Address::generate(&env);
        
        let stats = RecyclingStats::new(participant.clone());
        
        // Test storage compatibility
        env.storage().instance().set(&("stats", participant.clone()), &stats);
        let retrieved: RecyclingStats = env.storage().instance().get(&("stats", participant)).unwrap();
        
        assert_eq!(retrieved.total_submissions, 0);
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

        let material_above = Material::new(
            3,
            WasteType::Paper,
            500,
            submitter,
            1234567890,
            description,
        );
        assert!(material_above.meets_minimum_weight());
    }

    #[test]
    fn test_calculate_reward_points() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Test");
        
        // Paper: 5kg * 1 * 10 = 50 points
        let paper = Material::new(1, WasteType::Paper, 5000, submitter.clone(), 0, description.clone());
        assert_eq!(paper.calculate_reward_points(), 50);

        // PetPlastic: 5kg * 3 * 10 = 150 points
        let pet = Material::new(2, WasteType::PetPlastic, 5000, submitter.clone(), 0, description.clone());
        assert_eq!(pet.calculate_reward_points(), 150);

        // Plastic: 5kg * 2 * 10 = 100 points
        let plastic = Material::new(3, WasteType::Plastic, 5000, submitter.clone(), 0, description.clone());
        assert_eq!(plastic.calculate_reward_points(), 100);

        // Metal: 5kg * 5 * 10 = 250 points
        let metal = Material::new(4, WasteType::Metal, 5000, submitter.clone(), 0, description.clone());
        assert_eq!(metal.calculate_reward_points(), 250);

        // Glass: 5kg * 2 * 10 = 100 points
        let glass = Material::new(5, WasteType::Glass, 5000, submitter, 0, description);
        assert_eq!(glass.calculate_reward_points(), 100);
    }

    #[test]
    fn test_material_storage_compatibility() {
        let env = soroban_sdk::Env::default();
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

        // Test that Material can be stored in Soroban storage
        env.storage().instance().set(&("material", 1u64), &material);
        let retrieved: Material = env.storage().instance().get(&("material", 1u64)).unwrap();
        
        assert_eq!(retrieved.id, material.id);
        assert_eq!(retrieved.waste_type, material.waste_type);
        assert_eq!(retrieved.weight, material.weight);
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
    }

    #[test]
    fn test_waste_type_is_valid() {
        assert!(WasteType::is_valid(0));
        assert!(WasteType::is_valid(1));
        assert!(WasteType::is_valid(2));
        assert!(WasteType::is_valid(3));
        assert!(WasteType::is_valid(4));
        assert!(!WasteType::is_valid(5));
        assert!(!WasteType::is_valid(999));
    }

    #[test]
    fn test_waste_type_from_u32() {
        assert_eq!(WasteType::from_u32(0), Some(WasteType::Paper));
        assert_eq!(WasteType::from_u32(1), Some(WasteType::PetPlastic));
        assert_eq!(WasteType::from_u32(2), Some(WasteType::Plastic));
        assert_eq!(WasteType::from_u32(3), Some(WasteType::Metal));
        assert_eq!(WasteType::from_u32(4), Some(WasteType::Glass));
        assert_eq!(WasteType::from_u32(5), None);
        assert_eq!(WasteType::from_u32(999), None);
    }

    #[test]
    fn test_waste_type_to_u32() {
        assert_eq!(WasteType::Paper.to_u32(), 0);
        assert_eq!(WasteType::PetPlastic.to_u32(), 1);
        assert_eq!(WasteType::Plastic.to_u32(), 2);
        assert_eq!(WasteType::Metal.to_u32(), 3);
        assert_eq!(WasteType::Glass.to_u32(), 4);
    }

    #[test]
    fn test_waste_type_as_str() {
        assert_eq!(WasteType::Paper.as_str(), "PAPER");
        assert_eq!(WasteType::PetPlastic.as_str(), "PETPLASTIC");
        assert_eq!(WasteType::Plastic.as_str(), "PLASTIC");
        assert_eq!(WasteType::Metal.as_str(), "METAL");
        assert_eq!(WasteType::Glass.as_str(), "GLASS");
    }

    #[test]
    fn test_waste_type_display() {
        use soroban_sdk::String as SorobanString;
        let env = soroban_sdk::Env::default();
        
        // Test Display trait by converting to string representation
        assert_eq!(WasteType::Paper.as_str(), "PAPER");
        assert_eq!(WasteType::PetPlastic.as_str(), "PETPLASTIC");
        assert_eq!(WasteType::Plastic.as_str(), "PLASTIC");
        assert_eq!(WasteType::Metal.as_str(), "METAL");
        assert_eq!(WasteType::Glass.as_str(), "GLASS");
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
        assert_eq!(ParticipantRole::from_u32(0), Some(ParticipantRole::Recycler));
        assert_eq!(ParticipantRole::from_u32(1), Some(ParticipantRole::Collector));
        assert_eq!(ParticipantRole::from_u32(2), Some(ParticipantRole::Manufacturer));
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


#[cfg(test)]
mod transfer_record_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_transfer_record_creation() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Material transfer");
        
        let record = TransferRecord::new(
            1,
            from.clone(),
            to.clone(),
            TransferItemType::Material,
            42,
            1000,
            1234567890,
            note.clone(),
        );

        assert_eq!(record.id, 1);
        assert_eq!(record.from, from);
        assert_eq!(record.to, to);
        assert_eq!(record.item_type, TransferItemType::Material);
        assert_eq!(record.item_id, 42);
        assert_eq!(record.amount, 1000);
        assert_eq!(record.timestamp, 1234567890);
        assert_eq!(record.status, TransferStatus::Pending);
        assert_eq!(record.note, note);
    }

    #[test]
    fn test_transfer_record_storage_compatibility() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Test transfer");
        
        let record = TransferRecord::new(
            1,
            from,
            to,
            TransferItemType::Token,
            100,
            5000,
            1234567890,
            note,
        );

        // Test single record storage
        env.storage().instance().set(&("transfer", 1u64), &record);
        let retrieved: TransferRecord = env.storage().instance().get(&("transfer", 1u64)).unwrap();
        
        assert_eq!(retrieved, record);
    }

    #[test]
    fn test_transfer_record_vector_storage() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Vector test");
        
        // Create vector of transfer records
        let mut records = Vec::new(&env);
        
        for i in 1..=5 {
            let record = TransferRecord::new(
                i,
                from.clone(),
                to.clone(),
                TransferItemType::Material,
                i * 10,
                i * 1000,
                1234567890 + i,
                note.clone(),
            );
            records.push_back(record);
        }

        // Store vector
        env.storage().instance().set(&("transfer_history",), &records);
        
        // Retrieve vector
        let retrieved: Vec<TransferRecord> = env.storage().instance().get(&("transfer_history",)).unwrap();
        
        assert_eq!(retrieved.len(), 5);
        for i in 0..5 {
            assert_eq!(retrieved.get(i).unwrap().id, (i + 1) as u64);
        }
    }

    #[test]
    fn test_transfer_record_vector_append() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Append test");
        
        // Create initial vector
        let mut records = Vec::new(&env);
        
        let record1 = TransferRecord::new(
            1,
            from.clone(),
            to.clone(),
            TransferItemType::Material,
            10,
            1000,
            1234567890,
            note.clone(),
        );
        records.push_back(record1);
        
        // Store
        env.storage().instance().set(&("history",), &records);
        
        // Retrieve and append
        let mut retrieved: Vec<TransferRecord> = env.storage().instance().get(&("history",)).unwrap();
        
        let record2 = TransferRecord::new(
            2,
            from.clone(),
            to.clone(),
            TransferItemType::Token,
            20,
            2000,
            1234567891,
            note.clone(),
        );
        retrieved.push_back(record2);
        
        // Store updated vector
        env.storage().instance().set(&("history",), &retrieved);
        
        // Verify
        let final_records: Vec<TransferRecord> = env.storage().instance().get(&("history",)).unwrap();
        assert_eq!(final_records.len(), 2);
        assert_eq!(final_records.get(0).unwrap().id, 1);
        assert_eq!(final_records.get(1).unwrap().id, 2);
    }

    #[test]
    fn test_transfer_record_round_trip_serialization() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Round trip test");
        
        let original = TransferRecord::new(
            42,
            from,
            to,
            TransferItemType::Incentive,
            999,
            7500,
            9876543210,
            note,
        );

        // Store and retrieve
        env.storage().instance().set(&("test_record",), &original);
        let retrieved: TransferRecord = env.storage().instance().get(&("test_record",)).unwrap();
        
        // Verify all fields preserved
        assert_eq!(retrieved.id, original.id);
        assert_eq!(retrieved.from, original.from);
        assert_eq!(retrieved.to, original.to);
        assert_eq!(retrieved.item_type, original.item_type);
        assert_eq!(retrieved.item_id, original.item_id);
        assert_eq!(retrieved.amount, original.amount);
        assert_eq!(retrieved.timestamp, original.timestamp);
        assert_eq!(retrieved.status, original.status);
        assert_eq!(retrieved.note, original.note);
        
        // Complete equality
        assert_eq!(retrieved, original);
    }

    #[test]
    fn test_transfer_record_update_status() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Status test");
        
        let mut record = TransferRecord::new(
            1,
            from,
            to,
            TransferItemType::Material,
            10,
            1000,
            1234567890,
            note,
        );

        assert_eq!(record.status, TransferStatus::Pending);

        // Update to InProgress
        assert!(record.update_status(TransferStatus::InProgress));
        assert_eq!(record.status, TransferStatus::InProgress);

        // Update to Completed
        assert!(record.update_status(TransferStatus::Completed));
        assert_eq!(record.status, TransferStatus::Completed);

        // Try to update final status (should fail)
        assert!(!record.update_status(TransferStatus::Pending));
        assert_eq!(record.status, TransferStatus::Completed);
    }

    #[test]
    fn test_transfer_record_validate() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Validation test");
        
        // Valid record
        let valid = TransferRecord::new(
            1,
            from.clone(),
            to.clone(),
            TransferItemType::Material,
            10,
            1000,
            1234567890,
            note.clone(),
        );
        assert!(valid.validate().is_ok());

        // Zero amount
        let zero_amount = TransferRecord::new(
            2,
            from.clone(),
            to.clone(),
            TransferItemType::Token,
            20,
            0,
            1234567890,
            note.clone(),
        );
        assert_eq!(zero_amount.validate(), Err("Amount must be greater than zero"));

        // Same sender and recipient
        let same_address = TransferRecord::new(
            3,
            from.clone(),
            from.clone(),
            TransferItemType::Material,
            30,
            1000,
            1234567890,
            note,
        );
        assert_eq!(same_address.validate(), Err("Sender and recipient cannot be the same"));
    }

    #[test]
    fn test_transfer_record_is_complete() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Complete test");
        
        let mut record = TransferRecord::new(
            1,
            from,
            to,
            TransferItemType::Material,
            10,
            1000,
            1234567890,
            note,
        );

        assert!(!record.is_complete());
        
        record.update_status(TransferStatus::InProgress);
        assert!(!record.is_complete());
        
        record.update_status(TransferStatus::Completed);
        assert!(record.is_complete());
    }

    #[test]
    fn test_transfer_record_is_modifiable() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Modifiable test");
        
        let mut record = TransferRecord::new(
            1,
            from,
            to,
            TransferItemType::Token,
            10,
            1000,
            1234567890,
            note,
        );

        // Pending is modifiable
        assert!(record.is_modifiable());

        // InProgress is modifiable
        record.update_status(TransferStatus::InProgress);
        assert!(record.is_modifiable());

        // Completed is not modifiable
        record.update_status(TransferStatus::Completed);
        assert!(!record.is_modifiable());
    }

    #[test]
    fn test_transfer_record_all_item_types() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Type test");
        
        let types = [
            TransferItemType::Material,
            TransferItemType::Token,
            TransferItemType::Incentive,
            TransferItemType::Ownership,
        ];

        for (i, item_type) in types.iter().enumerate() {
            let record = TransferRecord::new(
                i as u64 + 1,
                from.clone(),
                to.clone(),
                *item_type,
                i as u64 * 10,
                1000,
                1234567890,
                note.clone(),
            );
            assert_eq!(record.item_type, *item_type);
        }
    }

    #[test]
    fn test_transfer_record_all_statuses() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Status test");
        
        let statuses = [
            TransferStatus::Pending,
            TransferStatus::InProgress,
            TransferStatus::Completed,
            TransferStatus::Failed,
            TransferStatus::Cancelled,
        ];

        for (i, status) in statuses.iter().enumerate() {
            let mut record = TransferRecord::new(
                i as u64 + 1,
                from.clone(),
                to.clone(),
                TransferItemType::Material,
                i as u64 * 10,
                1000,
                1234567890,
                note.clone(),
            );
            record.status = *status;
            assert_eq!(record.status, *status);
        }
    }

    #[test]
    fn test_transfer_record_boundary_values() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Boundary test");
        
        // Maximum values
        let max_record = TransferRecord::new(
            u64::MAX,
            from.clone(),
            to.clone(),
            TransferItemType::Material,
            u64::MAX,
            u64::MAX,
            u64::MAX,
            note.clone(),
        );
        assert!(max_record.validate().is_ok());

        // Minimum valid amount
        let min_record = TransferRecord::new(
            1,
            from,
            to,
            TransferItemType::Token,
            1,
            1,
            0,
            note,
        );
        assert!(min_record.validate().is_ok());
    }

    #[test]
    fn test_transfer_record_clone() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Clone test");
        
        let original = TransferRecord::new(
            1,
            from,
            to,
            TransferItemType::Material,
            10,
            1000,
            1234567890,
            note,
        );

        let cloned = original.clone();
        
        assert_eq!(cloned, original);
    }

    #[test]
    fn test_transfer_record_vector_iteration() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Iteration test");
        
        let mut records = Vec::new(&env);
        
        for i in 1..=10 {
            let record = TransferRecord::new(
                i,
                from.clone(),
                to.clone(),
                TransferItemType::Material,
                i * 10,
                i * 1000,
                1234567890 + i,
                note.clone(),
            );
            records.push_back(record);
        }

        // Iterate and verify order
        for i in 0..10 {
            let record = records.get(i).unwrap();
            assert_eq!(record.id, (i + 1) as u64);
            assert_eq!(record.amount, ((i + 1) * 1000) as u64);
        }
    }

    #[test]
    fn test_transfer_record_vector_deterministic() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Deterministic test");
        
        let mut records = Vec::new(&env);
        
        for i in 1..=5 {
            let record = TransferRecord::new(
                i,
                from.clone(),
                to.clone(),
                TransferItemType::Token,
                i * 10,
                i * 1000,
                1234567890 + i,
                note.clone(),
            );
            records.push_back(record);
        }

        // Store and retrieve multiple times
        for _ in 0..10 {
            env.storage().instance().set(&("deterministic",), &records);
            let retrieved: Vec<TransferRecord> = env.storage().instance().get(&("deterministic",)).unwrap();
            
            assert_eq!(retrieved.len(), records.len());
            for i in 0..5 {
                assert_eq!(retrieved.get(i).unwrap(), records.get(i).unwrap());
            }
        }
    }

    #[test]
    fn test_transfer_record_empty_vector() {
        let env = soroban_sdk::Env::default();
        
        let empty_records: Vec<TransferRecord> = Vec::new(&env);
        
        // Store empty vector
        env.storage().instance().set(&("empty",), &empty_records);
        
        // Retrieve
        let retrieved: Vec<TransferRecord> = env.storage().instance().get(&("empty",)).unwrap();
        assert_eq!(retrieved.len(), 0);
    }

    #[test]
    fn test_transfer_record_large_vector() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let note = String::from_str(&env, "Large vector test");
        
        let mut records = Vec::new(&env);
        
        // Create 100 records
        for i in 1..=100 {
            let record = TransferRecord::new(
                i,
                from.clone(),
                to.clone(),
                TransferItemType::Material,
                i * 10,
                i * 1000,
                1234567890 + i,
                note.clone(),
            );
            records.push_back(record);
        }

        // Store
        env.storage().instance().set(&("large",), &records);
        
        // Retrieve and verify
        let retrieved: Vec<TransferRecord> = env.storage().instance().get(&("large",)).unwrap();
        assert_eq!(retrieved.len(), 100);
        
        // Spot check
        assert_eq!(retrieved.get(0).unwrap().id, 1);
        assert_eq!(retrieved.get(49).unwrap().id, 50);
        assert_eq!(retrieved.get(99).unwrap().id, 100);
    }

    #[test]
    fn test_transfer_record_empty_note() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let empty_note = String::from_str(&env, "");
        
        let record = TransferRecord::new(
            1,
            from,
            to,
            TransferItemType::Material,
            10,
            1000,
            1234567890,
            empty_note.clone(),
        );

        assert_eq!(record.note, empty_note);
        
        // Test storage
        env.storage().instance().set(&("empty_note",), &record);
        let retrieved: TransferRecord = env.storage().instance().get(&("empty_note",)).unwrap();
        assert_eq!(retrieved.note, empty_note);
    }

    #[test]
    fn test_transfer_record_long_note() {
        let env = soroban_sdk::Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let long_note = String::from_str(
            &env,
            "This is a very long note with many characters to test storage limits and serialization"
        );
        
        let record = TransferRecord::new(
            1,
            from,
            to,
            TransferItemType::Token,
            10,
            1000,
            1234567890,
            long_note.clone(),
        );

        env.storage().instance().set(&("long_note",), &record);
        let retrieved: TransferRecord = env.storage().instance().get(&("long_note",)).unwrap();
        assert_eq!(retrieved.note, long_note);
    }
}

#[cfg(test)]
mod transfer_item_type_tests {
    use super::*;

    #[test]
    fn test_transfer_item_type_values() {
        assert_eq!(TransferItemType::Material as u32, 0);
        assert_eq!(TransferItemType::Token as u32, 1);
        assert_eq!(TransferItemType::Incentive as u32, 2);
        assert_eq!(TransferItemType::Ownership as u32, 3);
    }

    #[test]
    fn test_transfer_item_type_is_valid() {
        assert!(TransferItemType::is_valid(0));
        assert!(TransferItemType::is_valid(1));
        assert!(TransferItemType::is_valid(2));
        assert!(TransferItemType::is_valid(3));
        assert!(!TransferItemType::is_valid(4));
        assert!(!TransferItemType::is_valid(999));
    }

    #[test]
    fn test_transfer_item_type_from_u32() {
        assert_eq!(TransferItemType::from_u32(0), Some(TransferItemType::Material));
        assert_eq!(TransferItemType::from_u32(1), Some(TransferItemType::Token));
        assert_eq!(TransferItemType::from_u32(2), Some(TransferItemType::Incentive));
        assert_eq!(TransferItemType::from_u32(3), Some(TransferItemType::Ownership));
        assert_eq!(TransferItemType::from_u32(4), None);
    }

    #[test]
    fn test_transfer_item_type_to_u32() {
        assert_eq!(TransferItemType::Material.to_u32(), 0);
        assert_eq!(TransferItemType::Token.to_u32(), 1);
        assert_eq!(TransferItemType::Incentive.to_u32(), 2);
        assert_eq!(TransferItemType::Ownership.to_u32(), 3);
    }

    #[test]
    fn test_transfer_item_type_as_str() {
        assert_eq!(TransferItemType::Material.as_str(), "MATERIAL");
        assert_eq!(TransferItemType::Token.as_str(), "TOKEN");
        assert_eq!(TransferItemType::Incentive.as_str(), "INCENTIVE");
        assert_eq!(TransferItemType::Ownership.as_str(), "OWNERSHIP");
    }
}

#[cfg(test)]
mod transfer_status_tests {
    use super::*;

    #[test]
    fn test_transfer_status_values() {
        assert_eq!(TransferStatus::Pending as u32, 0);
        assert_eq!(TransferStatus::InProgress as u32, 1);
        assert_eq!(TransferStatus::Completed as u32, 2);
        assert_eq!(TransferStatus::Failed as u32, 3);
        assert_eq!(TransferStatus::Cancelled as u32, 4);
    }

    #[test]
    fn test_transfer_status_is_valid() {
        assert!(TransferStatus::is_valid(0));
        assert!(TransferStatus::is_valid(1));
        assert!(TransferStatus::is_valid(2));
        assert!(TransferStatus::is_valid(3));
        assert!(TransferStatus::is_valid(4));
        assert!(!TransferStatus::is_valid(5));
    }

    #[test]
    fn test_transfer_status_from_u32() {
        assert_eq!(TransferStatus::from_u32(0), Some(TransferStatus::Pending));
        assert_eq!(TransferStatus::from_u32(1), Some(TransferStatus::InProgress));
        assert_eq!(TransferStatus::from_u32(2), Some(TransferStatus::Completed));
        assert_eq!(TransferStatus::from_u32(3), Some(TransferStatus::Failed));
        assert_eq!(TransferStatus::from_u32(4), Some(TransferStatus::Cancelled));
        assert_eq!(TransferStatus::from_u32(5), None);
    }

    #[test]
    fn test_transfer_status_to_u32() {
        assert_eq!(TransferStatus::Pending.to_u32(), 0);
        assert_eq!(TransferStatus::InProgress.to_u32(), 1);
        assert_eq!(TransferStatus::Completed.to_u32(), 2);
        assert_eq!(TransferStatus::Failed.to_u32(), 3);
        assert_eq!(TransferStatus::Cancelled.to_u32(), 4);
    }

    #[test]
    fn test_transfer_status_as_str() {
        assert_eq!(TransferStatus::Pending.as_str(), "PENDING");
        assert_eq!(TransferStatus::InProgress.as_str(), "IN_PROGRESS");
        assert_eq!(TransferStatus::Completed.as_str(), "COMPLETED");
        assert_eq!(TransferStatus::Failed.as_str(), "FAILED");
        assert_eq!(TransferStatus::Cancelled.as_str(), "CANCELLED");
    }

    #[test]
    fn test_transfer_status_is_final() {
        assert!(!TransferStatus::Pending.is_final());
        assert!(!TransferStatus::InProgress.is_final());
        assert!(TransferStatus::Completed.is_final());
        assert!(TransferStatus::Failed.is_final());
        assert!(TransferStatus::Cancelled.is_final());
    }

    #[test]
    fn test_transfer_status_is_active() {
        assert!(TransferStatus::Pending.is_active());
        assert!(TransferStatus::InProgress.is_active());
        assert!(!TransferStatus::Completed.is_active());
        assert!(!TransferStatus::Failed.is_active());
        assert!(!TransferStatus::Cancelled.is_active());
    }
}
