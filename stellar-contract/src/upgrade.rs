use soroban_sdk::{contracttype, Address, Env, String};

/// Supported upgrade path.
///
/// The contract follows a state-preserving migration model: existing participant,
/// waste, and configuration data remain the source of truth across version bumps.
/// The upgrade path is limited to known versions and rejects downgrade or
/// deprecated targets before any persisted state is rewritten.
///
/// In practice this means:
/// - keep persisted records and config intact;
/// - validate the version transition before mutation;
/// - reject unknown or deprecated versions safely;
/// - only then move to the new implementation/version metadata.
///
/// Upgrade proposal status
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum UpgradeStatus {
    /// Proposal created, awaiting approval
    Proposed = 0,
    /// Proposal approved by admin
    Approved = 1,
    /// Upgrade executed
    Executed = 2,
    /// Proposal rejected
    Rejected = 3,
    /// Upgrade cancelled
    Cancelled = 4,
}

impl UpgradeStatus {
    pub fn to_u32(self) -> u32 {
        self as u32
    }

    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(UpgradeStatus::Proposed),
            1 => Some(UpgradeStatus::Approved),
            2 => Some(UpgradeStatus::Executed),
            3 => Some(UpgradeStatus::Rejected),
            4 => Some(UpgradeStatus::Cancelled),
            _ => None,
        }
    }

    pub fn is_final(&self) -> bool {
        matches!(
            self,
            UpgradeStatus::Executed | UpgradeStatus::Rejected | UpgradeStatus::Cancelled
        )
    }
}

/// Upgrade proposal for contract migration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeProposal {
    /// Unique proposal ID
    pub proposal_id: u64,
    /// Address of the new contract implementation
    pub new_implementation: Address,
    /// Description of the upgrade
    pub description: String,
    /// Address of the proposer
    pub proposer: Address,
    /// Current status of the proposal
    pub status: UpgradeStatus,
    /// Timestamp when proposal was created
    pub created_at: u64,
    /// Timestamp when proposal was executed (0 if not executed)
    pub executed_at: u64,
    /// Version number of the upgrade
    pub version: u32,
    /// Approval timestamp (0 if not approved)
    pub approved_at: u64,
    /// Address of the approver
    pub approved_by: Option<Address>,
}

impl UpgradeProposal {
    /// Creates a new upgrade proposal
    pub fn new(
        env: &Env,
        proposal_id: u64,
        new_implementation: Address,
        description: String,
        proposer: Address,
        version: u32,
    ) -> Self {
        Self {
            proposal_id,
            new_implementation,
            description,
            proposer,
            status: UpgradeStatus::Proposed,
            created_at: env.ledger().timestamp(),
            executed_at: 0,
            version,
            approved_at: 0,
            approved_by: None,
        }
    }

    /// Approves the upgrade proposal
    pub fn approve(&mut self, env: &Env, approver: Address) -> Result<(), &'static str> {
        if self.status != UpgradeStatus::Proposed {
            return Err("Proposal is not in Proposed state");
        }
        self.status = UpgradeStatus::Approved;
        self.approved_at = env.ledger().timestamp();
        self.approved_by = Some(approver);
        Ok(())
    }

    /// Executes the upgrade
    pub fn execute(&mut self, env: &Env) -> Result<(), &'static str> {
        if self.status != UpgradeStatus::Approved {
            return Err("Proposal must be approved before execution");
        }
        self.status = UpgradeStatus::Executed;
        self.executed_at = env.ledger().timestamp();
        Ok(())
    }

    /// Rejects the upgrade proposal
    pub fn reject(&mut self) -> Result<(), &'static str> {
        if self.status != UpgradeStatus::Proposed {
            return Err("Only proposed upgrades can be rejected");
        }
        self.status = UpgradeStatus::Rejected;
        Ok(())
    }

    /// Cancels the upgrade proposal
    pub fn cancel(&mut self) -> Result<(), &'static str> {
        if self.status.is_final() {
            return Err("Cannot cancel finalized upgrade");
        }
        self.status = UpgradeStatus::Cancelled;
        Ok(())
    }
}

/// Proxy contract state for managing upgrades
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProxyState {
    /// Current implementation address
    pub current_implementation: Address,
    /// Admin address
    pub admin: Address,
    /// Contract version
    pub version: u32,
    /// Last upgrade timestamp
    pub last_upgrade_at: u64,
}

impl ProxyState {
    /// Creates a new proxy state
    pub fn new(env: &Env, implementation: Address, admin: Address) -> Self {
        Self {
            current_implementation: implementation,
            admin,
            version: 1,
            last_upgrade_at: env.ledger().timestamp(),
        }
    }

    /// Updates the implementation address
    pub fn update_implementation(
        &mut self,
        env: &Env,
        new_implementation: Address,
        new_version: u32,
    ) -> Result<(), &'static str> {
        if new_version <= self.version {
            return Err("New version must be greater than current version");
        }
        self.current_implementation = new_implementation;
        self.version = new_version;
        self.last_upgrade_at = env.ledger().timestamp();
        Ok(())
    }
}

/// Upgrade history entry
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeHistory {
    /// Version number
    pub version: u32,
    /// Previous implementation address
    pub previous_implementation: Address,
    /// New implementation address
    pub new_implementation: Address,
    /// Timestamp of upgrade
    pub upgraded_at: u64,
    /// Address of the executor
    pub executed_by: Address,
}

impl UpgradeHistory {
    /// Creates a new upgrade history entry
    pub fn new(
        env: &Env,
        version: u32,
        previous_implementation: Address,
        new_implementation: Address,
        executed_by: Address,
    ) -> Self {
        Self {
            version,
            previous_implementation,
            new_implementation,
            upgraded_at: env.ledger().timestamp(),
            executed_by,
        }
    }
}
