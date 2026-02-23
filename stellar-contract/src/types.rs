use soroban_sdk::{contracttype, Address, String};

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

#[cfg(test)]
mod material_tests {
    use super::*;

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
        assert_eq!(format!("{}", WasteType::Paper), "PAPER");
        assert_eq!(format!("{}", WasteType::PetPlastic), "PETPLASTIC");
        assert_eq!(format!("{}", WasteType::Plastic), "PLASTIC");
        assert_eq!(format!("{}", WasteType::Metal), "METAL");
        assert_eq!(format!("{}", WasteType::Glass), "GLASS");
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
