//! Incentive management domain module — Issue #925, updated #1102
//!
//! Re-exports incentive-related types for domain-scoped imports.
//!
//! # Module boundary (consistent with participant and waste splits)
//!
//! | Layer            | Module               | Responsibility                                    |
//! |------------------|----------------------|---------------------------------------------------|
//! | Domain logic     | `incentive`          | Reward calculation, scheduling, budget exhaustion |
//! | Storage          | `incentive_storage`  | Raw CRUD: read/write/delete Incentive records     |
//! | Domain re-export | `incentive_mgmt` (this) | Re-exports types for domain-scoped imports     |
//!
//! State-changing operations on `ScavengerContract` in `lib.rs`:
//! - `create_incentive` (manufacturer only)
//! - `update_incentive`, `update_incentive_status`, `deactivate_incentive`
//! - `schedule_incentive`
//! - `claim_incentive_reward`
//! - `distribute_rewards`
//! - `get_incentive_by_id`, `get_incentives`, `get_active_incentives`
//! - `get_incentives_by_waste_type`, `get_incentives_by_rewarder`
//! - `get_active_mfr_incentive`
//! - `calculate_incentive_reward`

pub use crate::types::Incentive;
