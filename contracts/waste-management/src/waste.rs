use soroban_sdk::{contracttype, Address};

/// Enum representing different types of waste
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WasteType {
    Plastic,
    Glass,
    Metal,
    Paper,
    Organic,
    Electronic,
    Hazardous,
    Mixed,
}

/// Main Waste struct with all required fields
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Waste {
    /// Unique identifier for the waste entry
    pub waste_id: u128,
    /// Type of waste (Plastic, Glass, Metal, etc.)
    pub waste_type: WasteType,
    /// Weight of the waste in grams
    pub weight: u128,
    /// Current owner of the waste
    pub current_owner: Address,
    /// Latitude coordinate (multiplied by 10^7 for precision)
    pub latitude: i128,
    /// Longitude coordinate (multiplied by 10^7 for precision)
    pub longitude: i128,
    /// Timestamp when the waste was recycled
    pub recycled_timestamp: u64,
    /// Whether the waste entry is active
    pub is_active: bool,
    /// Whether the waste has been confirmed
    pub is_confirmed: bool,
    /// Address of the confirmer
    pub confirmer: Address,
}

/// Builder pattern for constructing Waste instances
#[derive(Clone, Debug)]
pub struct WasteBuilder {
    waste_id: Option<u128>,
    waste_type: Option<WasteType>,
    weight: Option<u128>,
    current_owner: Option<Address>,
    latitude: Option<i128>,
    longitude: Option<i128>,
    recycled_timestamp: Option<u64>,
    is_active: Option<bool>,
    is_confirmed: Option<bool>,
    confirmer: Option<Address>,
}

impl WasteBuilder {
    /// Create a new WasteBuilder instance
    pub fn new() -> Self {
        Self {
            waste_id: None,
            waste_type: None,
            weight: None,
            current_owner: None,
            latitude: None,
            longitude: None,
            recycled_timestamp: None,
            is_active: None,
            is_confirmed: None,
            confirmer: None,
        }
    }

    /// Set the waste_id
    pub fn waste_id(mut self, waste_id: u128) -> Self {
        self.waste_id = Some(waste_id);
        self
    }

    /// Set the waste_type
    pub fn waste_type(mut self, waste_type: WasteType) -> Self {
        self.waste_type = Some(waste_type);
        self
    }

    /// Set the weight
    pub fn weight(mut self, weight: u128) -> Self {
        self.weight = Some(weight);
        self
    }

    /// Set the current_owner
    pub fn current_owner(mut self, current_owner: Address) -> Self {
        self.current_owner = Some(current_owner);
        self
    }

    /// Set the latitude
    pub fn latitude(mut self, latitude: i128) -> Self {
        self.latitude = Some(latitude);
        self
    }

    /// Set the longitude
    pub fn longitude(mut self, longitude: i128) -> Self {
        self.longitude = Some(longitude);
        self
    }

    /// Set the recycled_timestamp
    pub fn recycled_timestamp(mut self, recycled_timestamp: u64) -> Self {
        self.recycled_timestamp = Some(recycled_timestamp);
        self
    }

    /// Set the is_active flag
    pub fn is_active(mut self, is_active: bool) -> Self {
        self.is_active = Some(is_active);
        self
    }

    /// Set the is_confirmed flag
    pub fn is_confirmed(mut self, is_confirmed: bool) -> Self {
        self.is_confirmed = Some(is_confirmed);
        self
    }

    /// Set the confirmer
    pub fn confirmer(mut self, confirmer: Address) -> Self {
        self.confirmer = Some(confirmer);
        self
    }

    /// Build the Waste instance
    /// Panics if any required field is missing
    pub fn build(self) -> Waste {
        Waste {
            waste_id: self.waste_id.expect("waste_id is required"),
            waste_type: self.waste_type.expect("waste_type is required"),
            weight: self.weight.expect("weight is required"),
            current_owner: self.current_owner.expect("current_owner is required"),
            latitude: self.latitude.expect("latitude is required"),
            longitude: self.longitude.expect("longitude is required"),
            recycled_timestamp: self.recycled_timestamp.expect("recycled_timestamp is required"),
            is_active: self.is_active.expect("is_active is required"),
            is_confirmed: self.is_confirmed.expect("is_confirmed is required"),
            confirmer: self.confirmer.expect("confirmer is required"),
        }
    }
}

impl Default for WasteBuilder {
    fn default() -> Self {
        Self::new()
    }
}
