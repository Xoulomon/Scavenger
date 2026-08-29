//! Waste management domain module — Issue #925, updated #1101
//!
//! Re-exports waste-related types for domain-scoped imports.
//!
//! # Module boundary (consistent with participant split)
//!
//! | Layer            | Module            | Responsibility                              |
//! |------------------|-------------------|---------------------------------------------|
//! | Domain logic     | `waste`           | State guards, route validation, weight checks |
//! | Storage          | `waste_storage`   | Raw CRUD: read/write/delete Waste records   |
//! | Domain re-export | `waste_mgmt` (this) | Re-exports types for domain-scoped imports |
//!
//! State-changing operations on `ScavengerContract` in `lib.rs`:
//! - `submit_material`, `recycle_waste` (v1/v2 registration)
//! - `verify_material`, `verify_materials_batch`
//! - `transfer_waste`, `transfer_waste_v2`, `batch_transfer_waste`
//! - `transfer_collected_waste`, `admin_override_transfer`
//! - `confirm_waste_details`, `reset_waste_confirmation`
//! - `deactivate_waste`, `batch_deactivate_waste`
//! - `split_waste`, `merge_wastes`
//! - `reserve_waste`, `cancel_reservation`
//! - `set_waste_grade`, `get_grade_history`, `get_wastes_by_grade`
//! - `mark_contaminated`, `report_contamination`, `get_contamination_score`
//! - `set_waste_ttl`, `get_expired_wastes`, `cleanup_expired_wastes`
//! - `add_waste_tag`, `remove_waste_tag`
//! - `set_waste_image`, `add_waste_document`
//! - `update_processing_status`, `get_wastes_by_status`
//! - `set_processing_cost`, `set_waste_composition`

pub use crate::types::{
    ContaminationReport, GradeRecord, Material, ProcessingRecord, ProcessingStatus,
    Waste, WasteBatch, WasteCertification, WasteGrade, WasteTransfer, WasteType,
};
