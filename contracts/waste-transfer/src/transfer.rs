use soroban_sdk::{contracttype, Address, Symbol};

/// Struct to track waste transfers in the supply chain
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WasteTransfer {
    /// Unique identifier for the waste item
    pub waste_id: u128,
    
    /// Address transferring the waste
    pub from: Address,
    
    /// Address receiving the waste
    pub to: Address,
    
    /// Unix timestamp of the transfer (seconds since epoch)
    pub timestamp: u64,
    
    /// Latitude coordinate (scaled by 10^7 for precision)
    /// Example: 37.7749 * 10^7 = 377749000
    pub latitude: i128,
    
    /// Longitude coordinate (scaled by 10^7 for precision)
    /// Example: -122.4194 * 10^7 = -1224194000
    pub longitude: i128,
    
    /// Additional notes about the transfer
    pub notes: Symbol,
}

impl WasteTransfer {
    /// Create a new waste transfer record
    pub fn new(
        waste_id: u128,
        from: Address,
        to: Address,
        timestamp: u64,
        latitude: i128,
        longitude: i128,
        notes: Symbol,
    ) -> Self {
        Self {
            waste_id,
            from,
            to,
            timestamp,
            latitude,
            longitude,
            notes,
        }
    }
}
