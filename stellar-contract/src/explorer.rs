//! Blockchain explorer integration for waste tracking.
use soroban_sdk::{contracttype, Address, String};

/// Transaction tracking information for blockchain explorer integration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransactionTracker {
    /// Unique transaction ID
    pub tx_id: u64,
    /// Transaction hash (from blockchain)
    pub tx_hash: String,
    /// Type of transaction
    pub tx_type: TransactionType,
    /// Address of the initiator
    pub initiator: Address,
    /// Timestamp of transaction
    pub timestamp: u64,
    /// Status of transaction
    pub status: TransactionStatus,
    /// Associated waste ID (if applicable)
    pub waste_id: Option<u128>,
    /// Associated participant address (if applicable)
    pub participant: Option<Address>,
    /// Transaction details/notes
    pub details: String,
    /// Explorer link (e.g., Stellar Expert URL)
    pub explorer_link: String,
}

/// Types of transactions tracked
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TransactionType {
    /// Waste registration
    WasteRegistration = 0,
    /// Waste transfer
    WasteTransfer = 1,
    /// Waste verification
    WasteVerification = 2,
    /// Participant registration
    ParticipantRegistration = 3,
    /// Incentive creation
    IncentiveCreation = 4,
    /// Reward distribution
    RewardDistribution = 5,
    /// Contract upgrade
    ContractUpgrade = 6,
    /// Admin action
    AdminAction = 7,
}

impl TransactionType {
    pub fn to_u32(self) -> u32 {
        self as u32
    }

    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(TransactionType::WasteRegistration),
            1 => Some(TransactionType::WasteTransfer),
            2 => Some(TransactionType::WasteVerification),
            3 => Some(TransactionType::ParticipantRegistration),
            4 => Some(TransactionType::IncentiveCreation),
            5 => Some(TransactionType::RewardDistribution),
            6 => Some(TransactionType::ContractUpgrade),
            7 => Some(TransactionType::AdminAction),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            TransactionType::WasteRegistration => "WASTE_REGISTRATION",
            TransactionType::WasteTransfer => "WASTE_TRANSFER",
            TransactionType::WasteVerification => "WASTE_VERIFICATION",
            TransactionType::ParticipantRegistration => "PARTICIPANT_REGISTRATION",
            TransactionType::IncentiveCreation => "INCENTIVE_CREATION",
            TransactionType::RewardDistribution => "REWARD_DISTRIBUTION",
            TransactionType::ContractUpgrade => "CONTRACT_UPGRADE",
            TransactionType::AdminAction => "ADMIN_ACTION",
        }
    }
}

/// Transaction status
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TransactionStatus {
    /// Transaction pending
    Pending = 0,
    /// Transaction confirmed
    Confirmed = 1,
    /// Transaction failed
    Failed = 2,
    /// Transaction reverted
    Reverted = 3,
}

impl TransactionStatus {
    pub fn to_u32(self) -> u32 {
        self as u32
    }

    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(TransactionStatus::Pending),
            1 => Some(TransactionStatus::Confirmed),
            2 => Some(TransactionStatus::Failed),
            3 => Some(TransactionStatus::Reverted),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            TransactionStatus::Pending => "PENDING",
            TransactionStatus::Confirmed => "CONFIRMED",
            TransactionStatus::Failed => "FAILED",
            TransactionStatus::Reverted => "REVERTED",
        }
    }
}

impl TransactionTracker {
    /// Creates a new transaction tracker
    pub fn new(
        env: &soroban_sdk::Env,
        tx_id: u64,
        tx_hash: String,
        tx_type: TransactionType,
        initiator: Address,
        details: String,
    ) -> Self {
        let explorer_link = Self::generate_explorer_link(env, &tx_hash);

        Self {
            tx_id,
            tx_hash,
            tx_type,
            initiator,
            timestamp: env.ledger().timestamp(),
            status: TransactionStatus::Pending,
            waste_id: None,
            participant: None,
            details,
            explorer_link,
        }
    }

    /// Generates an explorer link for the transaction
    fn generate_explorer_link(env: &soroban_sdk::Env, tx_hash: &String) -> String {
        // Format: https://stellar.expert/explorer/testnet/tx/{tx_hash}
        let base = soroban_sdk::String::from_str(env, "https://stellar.expert/explorer/testnet/tx/");
        let mut link = base;
        link.append(tx_hash);
        link
    }

    /// Sets the waste ID associated with this transaction
    pub fn set_waste_id(&mut self, waste_id: u128) {
        self.waste_id = Some(waste_id);
    }

    /// Sets the participant associated with this transaction
    pub fn set_participant(&mut self, participant: Address) {
        self.participant = Some(participant);
    }

    /// Confirms the transaction
    pub fn confirm(&mut self) {
        self.status = TransactionStatus::Confirmed;
    }

    /// Marks transaction as failed
    pub fn fail(&mut self) {
        self.status = TransactionStatus::Failed;
    }

    /// Marks transaction as reverted
    pub fn revert(&mut self) {
        self.status = TransactionStatus::Reverted;
    }

    /// Checks if transaction is finalized
    pub fn is_finalized(&self) -> bool {
        matches!(
            self.status,
            TransactionStatus::Confirmed | TransactionStatus::Failed | TransactionStatus::Reverted
        )
    }
}

/// Explorer configuration for blockchain integration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExplorerConfig {
    /// Base URL for the explorer
    pub base_url: String,
    /// Network name (testnet, mainnet, etc.)
    pub network: String,
    /// Contract address
    pub contract_address: Address,
    /// Whether explorer integration is enabled
    pub enabled: bool,
}

impl ExplorerConfig {
    /// Creates a new explorer configuration
    pub fn new(
        env: &soroban_sdk::Env,
        base_url: String,
        network: String,
        contract_address: Address,
    ) -> Self {
        Self {
            base_url,
            network,
            contract_address,
            enabled: true,
        }
    }

    /// Generates a transaction URL
    pub fn get_transaction_url(&self, env: &soroban_sdk::Env, tx_hash: &String) -> String {
        let mut url = self.base_url.clone();
        url.append(&soroban_sdk::String::from_str(env, "/explorer/"));
        url.append(&self.network);
        url.append(&soroban_sdk::String::from_str(env, "/tx/"));
        url.append(tx_hash);
        url
    }

    /// Generates a contract URL
    pub fn get_contract_url(&self, env: &soroban_sdk::Env) -> String {
        let mut url = self.base_url.clone();
        url.append(&soroban_sdk::String::from_str(env, "/explorer/"));
        url.append(&self.network);
        url.append(&soroban_sdk::String::from_str(env, "/contract/"));
        url.append(&soroban_sdk::String::from_str(
            env,
            &self.contract_address.to_string(),
        ));
        url
    }

    /// Generates an account URL
    pub fn get_account_url(&self, env: &soroban_sdk::Env, account: &Address) -> String {
        let mut url = self.base_url.clone();
        url.append(&soroban_sdk::String::from_str(env, "/explorer/"));
        url.append(&self.network);
        url.append(&soroban_sdk::String::from_str(env, "/account/"));
        url.append(&soroban_sdk::String::from_str(env, &account.to_string()));
        url
    }
}
