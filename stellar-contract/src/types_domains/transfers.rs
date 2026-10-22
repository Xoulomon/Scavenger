use super::*;

/// Represents a transfer record in the recycling system.
/// This struct is fully compatible with Soroban storage and implements
/// deterministic serialization for safe storage and retrieval.
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
        matches!(value, 0..=4)
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
