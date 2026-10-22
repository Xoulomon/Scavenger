//! Admin domain module (issue #925).
//!
//! Re-exports admin-related contract types for consumers who want to import
//! by domain rather than through the top-level `lib.rs`.
//!
//! Admin-role model:
//! - The contract maintains a mutable admin list in instance storage.
//! - The first admin is the primary admin; the list is treated as the trusted
//!   authority for privileged operations.
//! - Multi-signature approval is layered on top of the same admin set via
//!   `set_multisig_threshold` and the proposal workflow.
//! - Every privileged mutation must call `require_admin` before state writes.
//!
//! Privileged functions guarded by admin checks before mutation include:
//! - `initialize_admin`, `transfer_admin`, `add_admin`, `remove_admin`
//! - `set_percentages`, `set_collector_percentage`, `set_owner_percentage`
//! - `set_token_address`, `set_seasonal_multiplier`, `set_min_weight`
//! - `pause`, `unpause`
//! - `propose_admin_action`, `approve_admin_proposal`, `execute_admin_proposal`
//! - `set_multisig_threshold`
//! - `grant_certification`
//! - any admin-only configuration or emergency action in `lib.rs`
//!
//! All state-changing admin operations are implemented on `ScavengerContract`
//! in `lib.rs`:
//! - `initialize_admin`, `get_admin`, `get_admins`, `transfer_admin`
//! - `add_admin`, `remove_admin`
//! - `set_charity_contract`, `get_charity_contract`
//! - `set_percentages`, `set_collector_percentage`, `set_owner_percentage`
//! - `set_token_address`, `get_token_address`
//! - `set_seasonal_multiplier`, `get_current_multiplier`
//! - `set_min_weight`, `get_min_weight`
//! - `pause`, `unpause`, `is_paused`
//! - `propose_admin_action`, `approve_admin_proposal`, `execute_admin_proposal`
//! - `set_multisig_threshold`, `get_multisig_threshold`
//!
//! Issue #1085: `AdminAction`, `AdminProposal`, and `RewardConfig` were
//! moved here from `lib.rs` verbatim (logical-boundary extraction only, no
//! behavior change). `lib.rs` re-exports them via
//! `pub use crate::admin::{AdminAction, AdminProposal, RewardConfig};` so
//! the public contract ABI (`crate::AdminAction` etc.) is unchanged.

use soroban_sdk::{contracttype, Address, Vec};

/// Actions that require multi-sig approval.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AdminAction {
    TransferAdmin(Vec<Address>),
    SetPercentages(u32, u32),
    DeactivateWaste(u128),
}

/// A pending multi-sig proposal.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminProposal {
    pub id: u64,
    pub action: AdminAction,
    pub proposer: Address,
    pub approvers: Vec<Address>,
    pub executed: bool,
    pub created_at: u64,
}

/// Reward distribution percentages stored as a single instance-storage entry.
///
/// Consolidating `collector_percentage` and `owner_percentage` into one struct
/// means a single `storage.get` call fetches both values, halving the number
/// of instance-storage lookups on every `_reward_tokens` invocation.
///
/// Migration note: contracts deployed with the old two-key layout
/// (`COL_PCT` / `OWN_PCT`) should call `set_percentages` once after upgrade
/// to write the new `RWD_CFG` key; the old keys are then unused and will
/// expire with the instance TTL.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardConfig {
    /// Percentage of total reward distributed to each collector in the transfer chain.
    pub collector_percentage: u32,
    /// Percentage of total reward distributed to the current waste owner.
    pub owner_percentage: u32,
}
