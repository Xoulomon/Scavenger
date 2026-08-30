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

pub use crate::{AdminAction, AdminProposal, RewardConfig};
