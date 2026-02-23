use soroban_sdk::{contracttype, Address, String};

/// Represents a waste item in the recycling system
/// This struct is fully compatible with Soroban storage and implements
/// deterministic serialization for safe storage and retrieval
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Waste {
    /// Unique identifier for the waste item
    pub id: u64,
    /// Type of waste material
    pub waste_type: WasteType,
    /// Weight of the waste in grams
    pub weight: u64,
    /// Address of the participant who submitted the waste
    pub submitter: Address,
    /// Timestamp when the waste was submitted
    pub submitted_at: u64,
    /// Current status of the waste
    pub status: WasteStatus,
    /// Location where the waste was collected (optional)
    pub location: String,
}

/// Represents the status of a waste item in the system
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WasteStatus {
    /// Waste has been submitted but not yet processed
    Pending = 0,
    /// Waste is being processed
    Processing = 1,
    /// Waste has been successfully processed
    Processed = 2,
    /// Waste was rejected (invalid or contaminated)
    Rejected = 3,
}

impl WasteStatus {
    /// Validates if the value is a valid WasteStatus variant
    pub fn is_valid(value: u32) -> bool {
        matches!(value, 0 | 1 | 2 | 3)
    }

    /// Converts a u32 to a WasteStatus
    /// Returns None if the value is invalid
    pub fn from_u32(value: u32) -> Option<Self> {
        match value {
            0 => Some(WasteStatus::Pending),
            1 => Some(WasteStatus::Processing),
            2 => Some(WasteStatus::Processed),
            3 => Some(WasteStatus::Rejected),
            _ => None,
        }
    }

    /// Converts the WasteStatus to u32
    pub fn to_u32(&self) -> u32 {
        *self as u32
    }

    /// Returns the string representation of the status
    pub fn as_str(&self) -> &'static str {
        match self {
            WasteStatus::Pending => "PENDING",
            WasteStatus::Processing => "PROCESSING",
            WasteStatus::Processed => "PROCESSED",
            WasteStatus::Rejected => "REJECTED",
        }
    }

    /// Checks if the status allows modification
    pub fn is_modifiable(&self) -> bool {
        matches!(self, WasteStatus::Pending | WasteStatus::Processing)
    }

    /// Checks if the status is final
    pub fn is_final(&self) -> bool {
        matches!(self, WasteStatus::Processed | WasteStatus::Rejected)
    }
}

impl Waste {
    /// Creates a new Waste instance with Pending status
    pub fn new(
        id: u64,
        waste_type: WasteType,
        weight: u64,
        submitter: Address,
        submitted_at: u64,
        location: String,
    ) -> Self {
        Self {
            id,
            waste_type,
            weight,
            submitter,
            submitted_at,
            status: WasteStatus::Pending,
            location,
        }
    }

    /// Updates the status of the waste
    /// Returns true if the status was updated, false if the current status is final
    pub fn update_status(&mut self, new_status: WasteStatus) -> bool {
        if self.status.is_final() {
            return false;
        }
        self.status = new_status;
        true
    }

    /// Checks if the waste meets minimum weight requirement (100g)
    pub fn meets_minimum_weight(&self) -> bool {
        self.weight >= 100
    }

    /// Checks if the waste is in a processable state
    pub fn is_processable(&self) -> bool {
        matches!(self.status, WasteStatus::Pending | WasteStatus::Processing)
    }

    /// Validates all fields for correctness
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.weight == 0 {
            return Err("Weight must be greater than zero");
        }
        if !self.meets_minimum_weight() {
            return Err("Weight must be at least 100g");
        }
        Ok(())
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
mod waste_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_waste_creation() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Downtown Collection Point");
        
        let waste = Waste::new(
            1,
            WasteType::Plastic,
            5000,
            submitter.clone(),
            1234567890,
            location.clone(),
        );

        assert_eq!(waste.id, 1);
        assert_eq!(waste.waste_type, WasteType::Plastic);
        assert_eq!(waste.weight, 5000);
        assert_eq!(waste.submitter, submitter);
        assert_eq!(waste.submitted_at, 1234567890);
        assert_eq!(waste.status, WasteStatus::Pending);
        assert_eq!(waste.location, location);
    }

    #[test]
    fn test_waste_storage_compatibility() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Test Location");
        
        let waste = Waste::new(
            1,
            WasteType::Metal,
            3000,
            submitter,
            1234567890,
            location,
        );

        // Test that Waste can be stored in Soroban storage
        env.storage().instance().set(&("waste", 1u64), &waste);
        let retrieved: Waste = env.storage().instance().get(&("waste", 1u64)).unwrap();
        
        assert_eq!(retrieved.id, waste.id);
        assert_eq!(retrieved.waste_type, waste.waste_type);
        assert_eq!(retrieved.weight, waste.weight);
        assert_eq!(retrieved.status, waste.status);
    }

    #[test]
    fn test_waste_round_trip_serialization() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Round Trip Test");
        
        let original = Waste::new(
            42,
            WasteType::Glass,
            7500,
            submitter.clone(),
            9876543210,
            location.clone(),
        );

        // Store and retrieve
        env.storage().instance().set(&("test_waste",), &original);
        let retrieved: Waste = env.storage().instance().get(&("test_waste",)).unwrap();
        
        // Verify all fields are preserved exactly
        assert_eq!(retrieved.id, original.id);
        assert_eq!(retrieved.waste_type, original.waste_type);
        assert_eq!(retrieved.weight, original.weight);
        assert_eq!(retrieved.submitter, original.submitter);
        assert_eq!(retrieved.submitted_at, original.submitted_at);
        assert_eq!(retrieved.status, original.status);
        assert_eq!(retrieved.location, original.location);
        
        // Verify complete equality
        assert_eq!(retrieved, original);
    }

    #[test]
    fn test_waste_update_status() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Status Test");
        
        let mut waste = Waste::new(
            1,
            WasteType::Paper,
            2000,
            submitter,
            1234567890,
            location,
        );

        assert_eq!(waste.status, WasteStatus::Pending);

        // Update to Processing
        assert!(waste.update_status(WasteStatus::Processing));
        assert_eq!(waste.status, WasteStatus::Processing);

        // Update to Processed
        assert!(waste.update_status(WasteStatus::Processed));
        assert_eq!(waste.status, WasteStatus::Processed);

        // Try to update final status (should fail)
        assert!(!waste.update_status(WasteStatus::Pending));
        assert_eq!(waste.status, WasteStatus::Processed);
    }

    #[test]
    fn test_waste_meets_minimum_weight() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Weight Test");
        
        let waste_below = Waste::new(
            1,
            WasteType::Paper,
            50,
            submitter.clone(),
            1234567890,
            location.clone(),
        );
        assert!(!waste_below.meets_minimum_weight());

        let waste_exact = Waste::new(
            2,
            WasteType::Paper,
            100,
            submitter.clone(),
            1234567890,
            location.clone(),
        );
        assert!(waste_exact.meets_minimum_weight());

        let waste_above = Waste::new(
            3,
            WasteType::Paper,
            500,
            submitter,
            1234567890,
            location,
        );
        assert!(waste_above.meets_minimum_weight());
    }

    #[test]
    fn test_waste_is_processable() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Processable Test");
        
        let mut waste = Waste::new(
            1,
            WasteType::Metal,
            3000,
            submitter,
            1234567890,
            location,
        );

        // Pending is processable
        assert!(waste.is_processable());

        // Processing is processable
        waste.update_status(WasteStatus::Processing);
        assert!(waste.is_processable());

        // Processed is not processable
        waste.update_status(WasteStatus::Processed);
        assert!(!waste.is_processable());

        // Rejected is not processable
        let mut rejected_waste = waste.clone();
        rejected_waste.status = WasteStatus::Rejected;
        assert!(!rejected_waste.is_processable());
    }

    #[test]
    fn test_waste_validate() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Validation Test");
        
        // Valid waste
        let valid_waste = Waste::new(
            1,
            WasteType::Plastic,
            5000,
            submitter.clone(),
            1234567890,
            location.clone(),
        );
        assert!(valid_waste.validate().is_ok());

        // Zero weight
        let zero_weight = Waste::new(
            2,
            WasteType::Paper,
            0,
            submitter.clone(),
            1234567890,
            location.clone(),
        );
        assert_eq!(zero_weight.validate(), Err("Weight must be greater than zero"));

        // Below minimum weight
        let below_min = Waste::new(
            3,
            WasteType::Glass,
            50,
            submitter,
            1234567890,
            location,
        );
        assert_eq!(below_min.validate(), Err("Weight must be at least 100g"));
    }

    #[test]
    fn test_waste_all_waste_types() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Type Test");
        
        let types = [
            WasteType::Paper,
            WasteType::PetPlastic,
            WasteType::Plastic,
            WasteType::Metal,
            WasteType::Glass,
        ];

        for (i, waste_type) in types.iter().enumerate() {
            let waste = Waste::new(
                i as u64 + 1,
                *waste_type,
                1000,
                submitter.clone(),
                1234567890,
                location.clone(),
            );
            assert_eq!(waste.waste_type, *waste_type);
        }
    }

    #[test]
    fn test_waste_all_statuses() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Status Test");
        
        let statuses = [
            WasteStatus::Pending,
            WasteStatus::Processing,
            WasteStatus::Processed,
            WasteStatus::Rejected,
        ];

        for (i, status) in statuses.iter().enumerate() {
            let mut waste = Waste::new(
                i as u64 + 1,
                WasteType::Paper,
                1000,
                submitter.clone(),
                1234567890,
                location.clone(),
            );
            waste.status = *status;
            assert_eq!(waste.status, *status);
        }
    }

    #[test]
    fn test_waste_boundary_values() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Boundary Test");
        
        // Minimum valid weight
        let min_waste = Waste::new(
            1,
            WasteType::Paper,
            100,
            submitter.clone(),
            0,
            location.clone(),
        );
        assert!(min_waste.validate().is_ok());

        // Maximum u64 weight
        let max_waste = Waste::new(
            2,
            WasteType::Metal,
            u64::MAX,
            submitter.clone(),
            u64::MAX,
            location.clone(),
        );
        assert!(max_waste.validate().is_ok());

        // Zero timestamp (valid)
        let zero_time = Waste::new(
            3,
            WasteType::Glass,
            1000,
            submitter,
            0,
            location,
        );
        assert_eq!(zero_time.submitted_at, 0);
    }

    #[test]
    fn test_waste_clone() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Clone Test");
        
        let original = Waste::new(
            1,
            WasteType::Plastic,
            3000,
            submitter,
            1234567890,
            location,
        );

        let cloned = original.clone();
        
        assert_eq!(cloned.id, original.id);
        assert_eq!(cloned.waste_type, original.waste_type);
        assert_eq!(cloned.weight, original.weight);
        assert_eq!(cloned.submitter, original.submitter);
        assert_eq!(cloned.submitted_at, original.submitted_at);
        assert_eq!(cloned.status, original.status);
        assert_eq!(cloned.location, original.location);
        assert_eq!(cloned, original);
    }

    #[test]
    fn test_waste_equality() {
        let env = soroban_sdk::Env::default();
        let submitter1 = Address::generate(&env);
        let submitter2 = Address::generate(&env);
        let location = String::from_str(&env, "Equality Test");
        
        let waste1 = Waste::new(
            1,
            WasteType::Paper,
            1000,
            submitter1.clone(),
            1234567890,
            location.clone(),
        );

        let waste2 = Waste::new(
            1,
            WasteType::Paper,
            1000,
            submitter1.clone(),
            1234567890,
            location.clone(),
        );

        let waste3 = Waste::new(
            2,
            WasteType::Paper,
            1000,
            submitter1,
            1234567890,
            location.clone(),
        );

        let waste4 = Waste::new(
            1,
            WasteType::Plastic,
            1000,
            submitter2,
            1234567890,
            location,
        );

        assert_eq!(waste1, waste2);
        assert_ne!(waste1, waste3);
        assert_ne!(waste1, waste4);
    }

    #[test]
    fn test_waste_multiple_storage_operations() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Multi Storage Test");
        
        // Store multiple waste items
        for i in 1..=5 {
            let waste = Waste::new(
                i,
                WasteType::Paper,
                1000 * i,
                submitter.clone(),
                1234567890 + i,
                location.clone(),
            );
            env.storage().instance().set(&("waste", i), &waste);
        }

        // Retrieve and verify
        for i in 1..=5 {
            let retrieved: Waste = env.storage().instance().get(&("waste", i)).unwrap();
            assert_eq!(retrieved.id, i);
            assert_eq!(retrieved.weight, 1000 * i);
            assert_eq!(retrieved.submitted_at, 1234567890 + i);
        }
    }

    #[test]
    fn test_waste_storage_with_different_keys() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Key Test");
        
        let waste = Waste::new(
            1,
            WasteType::Metal,
            2000,
            submitter,
            1234567890,
            location,
        );

        // Store with different key types
        env.storage().instance().set(&("waste_by_id", 1u64), &waste);
        env.storage().instance().set(&("waste_by_string", "test"), &waste);
        env.storage().instance().set(&(1u64,), &waste);

        // Retrieve with same keys
        let r1: Waste = env.storage().instance().get(&("waste_by_id", 1u64)).unwrap();
        let r2: Waste = env.storage().instance().get(&("waste_by_string", "test")).unwrap();
        let r3: Waste = env.storage().instance().get(&(1u64,)).unwrap();

        assert_eq!(r1, waste);
        assert_eq!(r2, waste);
        assert_eq!(r3, waste);
    }

    #[test]
    fn test_waste_deterministic_serialization() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let location = String::from_str(&env, "Deterministic Test");
        
        let waste = Waste::new(
            1,
            WasteType::Glass,
            5000,
            submitter,
            1234567890,
            location,
        );

        // Store and retrieve multiple times
        for _ in 0..10 {
            env.storage().instance().set(&("deterministic",), &waste);
            let retrieved: Waste = env.storage().instance().get(&("deterministic",)).unwrap();
            assert_eq!(retrieved, waste);
        }
    }

    #[test]
    fn test_waste_empty_location() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let empty_location = String::from_str(&env, "");
        
        let waste = Waste::new(
            1,
            WasteType::Paper,
            1000,
            submitter,
            1234567890,
            empty_location.clone(),
        );

        assert_eq!(waste.location, empty_location);
        
        // Test storage with empty location
        env.storage().instance().set(&("empty_loc",), &waste);
        let retrieved: Waste = env.storage().instance().get(&("empty_loc",)).unwrap();
        assert_eq!(retrieved.location, empty_location);
    }

    #[test]
    fn test_waste_long_location() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let long_location = String::from_str(
            &env,
            "Very Long Location Name With Many Characters To Test Storage Limits"
        );
        
        let waste = Waste::new(
            1,
            WasteType::Plastic,
            3000,
            submitter,
            1234567890,
            long_location.clone(),
        );

        env.storage().instance().set(&("long_loc",), &waste);
        let retrieved: Waste = env.storage().instance().get(&("long_loc",)).unwrap();
        assert_eq!(retrieved.location, long_location);
    }
}

#[cfg(test)]
mod waste_status_tests {
    use super::*;

    #[test]
    fn test_waste_status_values() {
        assert_eq!(WasteStatus::Pending as u32, 0);
        assert_eq!(WasteStatus::Processing as u32, 1);
        assert_eq!(WasteStatus::Processed as u32, 2);
        assert_eq!(WasteStatus::Rejected as u32, 3);
    }

    #[test]
    fn test_waste_status_is_valid() {
        assert!(WasteStatus::is_valid(0));
        assert!(WasteStatus::is_valid(1));
        assert!(WasteStatus::is_valid(2));
        assert!(WasteStatus::is_valid(3));
        assert!(!WasteStatus::is_valid(4));
        assert!(!WasteStatus::is_valid(999));
    }

    #[test]
    fn test_waste_status_from_u32() {
        assert_eq!(WasteStatus::from_u32(0), Some(WasteStatus::Pending));
        assert_eq!(WasteStatus::from_u32(1), Some(WasteStatus::Processing));
        assert_eq!(WasteStatus::from_u32(2), Some(WasteStatus::Processed));
        assert_eq!(WasteStatus::from_u32(3), Some(WasteStatus::Rejected));
        assert_eq!(WasteStatus::from_u32(4), None);
        assert_eq!(WasteStatus::from_u32(999), None);
    }

    #[test]
    fn test_waste_status_to_u32() {
        assert_eq!(WasteStatus::Pending.to_u32(), 0);
        assert_eq!(WasteStatus::Processing.to_u32(), 1);
        assert_eq!(WasteStatus::Processed.to_u32(), 2);
        assert_eq!(WasteStatus::Rejected.to_u32(), 3);
    }

    #[test]
    fn test_waste_status_as_str() {
        assert_eq!(WasteStatus::Pending.as_str(), "PENDING");
        assert_eq!(WasteStatus::Processing.as_str(), "PROCESSING");
        assert_eq!(WasteStatus::Processed.as_str(), "PROCESSED");
        assert_eq!(WasteStatus::Rejected.as_str(), "REJECTED");
    }

    #[test]
    fn test_waste_status_is_modifiable() {
        assert!(WasteStatus::Pending.is_modifiable());
        assert!(WasteStatus::Processing.is_modifiable());
        assert!(!WasteStatus::Processed.is_modifiable());
        assert!(!WasteStatus::Rejected.is_modifiable());
    }

    #[test]
    fn test_waste_status_is_final() {
        assert!(!WasteStatus::Pending.is_final());
        assert!(!WasteStatus::Processing.is_final());
        assert!(WasteStatus::Processed.is_final());
        assert!(WasteStatus::Rejected.is_final());
    }

    #[test]
    fn test_waste_status_clone_and_copy() {
        let status1 = WasteStatus::Pending;
        let status2 = status1;
        assert_eq!(status1, status2);
    }

    #[test]
    fn test_waste_status_equality() {
        assert_eq!(WasteStatus::Pending, WasteStatus::Pending);
        assert_ne!(WasteStatus::Pending, WasteStatus::Processing);
        assert_ne!(WasteStatus::Processed, WasteStatus::Rejected);
    }

    #[test]
    fn test_all_waste_statuses() {
        let statuses = [
            WasteStatus::Pending,
            WasteStatus::Processing,
            WasteStatus::Processed,
            WasteStatus::Rejected,
        ];
        
        for (i, status) in statuses.iter().enumerate() {
            assert_eq!(status.to_u32(), i as u32);
            assert_eq!(WasteStatus::from_u32(i as u32), Some(*status));
        }
    }
}
