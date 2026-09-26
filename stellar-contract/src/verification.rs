//! ZK verification utilities.
use soroban_sdk::{contracttype, Address, Env, String};

/// Verification state for waste materials
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum VerificationState {
    /// Waste submitted, awaiting verification
    Pending = 0,
    /// Verification in progress
    InProgress = 1,
    /// Verification completed successfully
    Verified = 2,
    /// Verification failed
    Failed = 3,
    /// Verification expired (timeout)
    Expired = 4,
}

impl VerificationState {
    pub fn to_u32(self) -> u32 {
        self as u32
    }

    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(VerificationState::Pending),
            1 => Some(VerificationState::InProgress),
            2 => Some(VerificationState::Verified),
            3 => Some(VerificationState::Failed),
            4 => Some(VerificationState::Expired),
            _ => None,
        }
    }

    pub fn is_final(&self) -> bool {
        matches!(
            self,
            VerificationState::Verified | VerificationState::Failed | VerificationState::Expired
        )
    }
}

/// Verification record for a waste item
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerificationRecord {
    /// Unique verification ID
    pub verification_id: u64,
    /// Waste ID being verified
    pub waste_id: u128,
    /// Current verification state
    pub state: VerificationState,
    /// Address of the verifier
    pub verifier: Address,
    /// Timestamp when verification started
    pub started_at: u64,
    /// Timestamp when verification completed (0 if not completed)
    pub completed_at: u64,
    /// Verification timeout (seconds from started_at)
    pub timeout_secs: u64,
    /// Verification notes/comments
    pub notes: String,
    /// Quality score (0-100)
    pub quality_score: u32,
}

impl VerificationRecord {
    /// Creates a new verification record
    pub fn new(
        env: &Env,
        verification_id: u64,
        waste_id: u128,
        verifier: Address,
        timeout_secs: u64,
    ) -> Self {
        Self {
            verification_id,
            waste_id,
            state: VerificationState::Pending,
            verifier,
            started_at: env.ledger().timestamp(),
            completed_at: 0,
            timeout_secs,
            notes: String::from_str(env, ""),
            quality_score: 0,
        }
    }

    /// Checks if verification has timed out
    pub fn is_timed_out(&self, current_timestamp: u64) -> bool {
        if self.state.is_final() {
            return false;
        }
        current_timestamp > self.started_at + self.timeout_secs
    }

    /// Transitions to InProgress state
    pub fn start_verification(&mut self) -> Result<(), &'static str> {
        if self.state != VerificationState::Pending {
            return Err("Verification already started");
        }
        self.state = VerificationState::InProgress;
        Ok(())
    }

    /// Completes verification successfully
    pub fn complete_verification(
        &mut self,
        env: &Env,
        quality_score: u32,
        notes: String,
    ) -> Result<(), &'static str> {
        if self.state != VerificationState::InProgress {
            return Err("Verification not in progress");
        }
        if quality_score > 100 {
            return Err("Quality score must be 0-100");
        }
        self.state = VerificationState::Verified;
        self.completed_at = env.ledger().timestamp();
        self.quality_score = quality_score;
        self.notes = notes;
        Ok(())
    }

    /// Fails verification
    pub fn fail_verification(
        &mut self,
        env: &Env,
        reason: String,
    ) -> Result<(), &'static str> {
        if self.state != VerificationState::InProgress {
            return Err("Verification not in progress");
        }
        self.state = VerificationState::Failed;
        self.completed_at = env.ledger().timestamp();
        self.notes = reason;
        Ok(())
    }

    /// Marks verification as expired
    pub fn mark_expired(&mut self) -> Result<(), &'static str> {
        if self.state.is_final() {
            return Err("Verification already finalized");
        }
        self.state = VerificationState::Expired;
        Ok(())
    }
}

/// Verification workflow state machine
pub struct VerificationWorkflow;

impl VerificationWorkflow {
    /// Validates state transition
    pub fn can_transition(from: VerificationState, to: VerificationState) -> bool {
        match (from, to) {
            // From Pending
            (VerificationState::Pending, VerificationState::InProgress) => true,
            (VerificationState::Pending, VerificationState::Expired) => true,
            // From InProgress
            (VerificationState::InProgress, VerificationState::Verified) => true,
            (VerificationState::InProgress, VerificationState::Failed) => true,
            (VerificationState::InProgress, VerificationState::Expired) => true,
            // No transitions from final states
            _ => false,
        }
    }

    /// Gets the next valid states from current state
    pub fn get_next_states(current: VerificationState) -> [Option<VerificationState>; 3] {
        match current {
            VerificationState::Pending => [
                Some(VerificationState::InProgress),
                Some(VerificationState::Expired),
                None,
            ],
            VerificationState::InProgress => [
                Some(VerificationState::Verified),
                Some(VerificationState::Failed),
                Some(VerificationState::Expired),
            ],
            _ => [None, None, None],
        }
    }
}
