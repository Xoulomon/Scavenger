//! Per-domain type groupings for the contract crate.
//!
//! The canonical type definitions still live in `crate::types` to avoid any
//! change to serialized layout or breaking external paths. These submodules
//! re-export the subset of types relevant to each domain so that call sites
//! can `use crate::types_domains::waste::*;` (etc.) instead of pulling in
//! the entire monolithic `types` module.

pub mod waste;
pub mod participant;
pub mod rewards;
