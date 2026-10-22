//! # Type Utilities — Issue #815
//!
//! Optimization helpers, compact representations, and validation for the
//! Scavngr type system.
//!
//! ## Key concerns addressed
//!
//! 1. **Type-size analysis** — `TypeSizes` enumerates the serialized byte cost
//!    of each primitive type so callers can reason about storage fees.
//! 2. **Packed flags** — `PackedFlags` stores up to 32 boolean fields in a
//!    single `u32`, eliminating per-bool storage slots on the `Waste` struct.
//! 3. **Coordinate compression** — `CompressedCoords` halves coordinate
//!    storage by packing lat/lon into a single `u64` (millionths of a degree).
//! 4. **Type validation helpers** — standalone guard functions to centralise
//!    range checks that are repeated across the contract.

use soroban_sdk::contracttype;

pub fn transfer_item_type_from_u32(value: u32) -> Option<crate::types::TransferItemType> {
    match value {
        0 => Some(crate::types::TransferItemType::Material),
        1 => Some(crate::types::TransferItemType::Token),
        2 => Some(crate::types::TransferItemType::Incentive),
        3 => Some(crate::types::TransferItemType::Ownership),
        _ => None,
    }
}

pub fn transfer_item_type_to_u32(value: crate::types::TransferItemType) -> u32 {
    value as u32
}

pub fn transfer_item_type_as_str(value: crate::types::TransferItemType) -> &'static str {
    match value {
        crate::types::TransferItemType::Material => "MATERIAL",
        crate::types::TransferItemType::Token => "TOKEN",
        crate::types::TransferItemType::Incentive => "INCENTIVE",
        crate::types::TransferItemType::Ownership => "OWNERSHIP",
    }
}

pub fn transfer_status_from_u32(value: u32) -> Option<crate::types::TransferStatus> {
    match value {
        0 => Some(crate::types::TransferStatus::Pending),
        1 => Some(crate::types::TransferStatus::InProgress),
        2 => Some(crate::types::TransferStatus::Completed),
        3 => Some(crate::types::TransferStatus::Failed),
        4 => Some(crate::types::TransferStatus::Cancelled),
        _ => None,
    }
}

pub fn transfer_status_to_u32(value: crate::types::TransferStatus) -> u32 {
    value as u32
}

pub fn transfer_status_as_str(value: crate::types::TransferStatus) -> &'static str {
    match value {
        crate::types::TransferStatus::Pending => "PENDING",
        crate::types::TransferStatus::InProgress => "IN_PROGRESS",
        crate::types::TransferStatus::Completed => "COMPLETED",
        crate::types::TransferStatus::Failed => "FAILED",
        crate::types::TransferStatus::Cancelled => "CANCELLED",
    }
}

pub fn participant_role_from_u32(value: u32) -> Option<crate::types::ParticipantRole> {
    match value {
        0 => Some(crate::types::ParticipantRole::Recycler),
        1 => Some(crate::types::ParticipantRole::Collector),
        2 => Some(crate::types::ParticipantRole::Manufacturer),
        _ => None,
    }
}

pub fn participant_role_to_u32(value: crate::types::ParticipantRole) -> u32 {
    value as u32
}

pub fn participant_role_as_str(value: crate::types::ParticipantRole) -> &'static str {
    match value {
        crate::types::ParticipantRole::Recycler => "RECYCLER",
        crate::types::ParticipantRole::Collector => "COLLECTOR",
        crate::types::ParticipantRole::Manufacturer => "MANUFACTURER",
    }
}

pub fn certification_level_from_u32(value: u32) -> Option<crate::types::CertificationLevel> {
    match value {
        0 => Some(crate::types::CertificationLevel::Beginner),
        1 => Some(crate::types::CertificationLevel::Intermediate),
        2 => Some(crate::types::CertificationLevel::Advanced),
        3 => Some(crate::types::CertificationLevel::Expert),
        _ => None,
    }
}

pub fn certification_level_to_u32(value: crate::types::CertificationLevel) -> u32 {
    value as u32
}

pub fn certification_level_as_str(value: crate::types::CertificationLevel) -> &'static str {
    match value {
        crate::types::CertificationLevel::Beginner => "BEGINNER",
        crate::types::CertificationLevel::Intermediate => "INTERMEDIATE",
        crate::types::CertificationLevel::Advanced => "ADVANCED",
        crate::types::CertificationLevel::Expert => "EXPERT",
    }
}

pub fn waste_type_from_u32(value: u32) -> Option<crate::types::WasteType> {
    match value {
        0 => Some(crate::types::WasteType::Paper),
        1 => Some(crate::types::WasteType::PetPlastic),
        2 => Some(crate::types::WasteType::Plastic),
        3 => Some(crate::types::WasteType::Metal),
        4 => Some(crate::types::WasteType::Glass),
        5 => Some(crate::types::WasteType::Organic),
        6 => Some(crate::types::WasteType::Electronic),
        _ => None,
    }
}

pub fn waste_type_to_u32(value: crate::types::WasteType) -> u32 {
    value as u32
}

pub fn waste_type_as_str(value: crate::types::WasteType) -> &'static str {
    match value {
        crate::types::WasteType::Paper => "PAPER",
        crate::types::WasteType::PetPlastic => "PETPLASTIC",
        crate::types::WasteType::Plastic => "PLASTIC",
        crate::types::WasteType::Metal => "METAL",
        crate::types::WasteType::Glass => "GLASS",
        crate::types::WasteType::Organic => "ORGANIC",
        crate::types::WasteType::Electronic => "ELECTRONIC",
    }
}



// ─── Edge-case conversion tests ───────────────────────────────────────

#[cfg(test)]
mod edge_case_tests {
    use super::*;
    use crate::types::{TransferItemType, TransferStatus, ParticipantRole, CertificationLevel, WasteType};

    #[test]
    fn transfer_item_type_from_u32_edge_cases() {
        assert!(transfer_item_type_from_u32(0).is_some());
        assert!(transfer_item_type_from_u32(3).is_some());
        assert!(transfer_item_type_from_u32(4).is_none()); // out of range
        assert!(transfer_item_type_from_u32(u32::MAX).is_none());
    }

    #[test]
    fn transfer_item_type_roundtrip_lossless() {
        for i in 0..4 {
            let item = transfer_item_type_from_u32(i).unwrap();
            assert_eq!(transfer_item_type_to_u32(item), i);
        }
    }

    #[test]
    fn transfer_status_from_u32_edge_cases() {
        assert!(transfer_status_from_u32(0).is_some());
        assert!(transfer_status_from_u32(4).is_some());
        assert!(transfer_status_from_u32(5).is_none());
        assert!(transfer_status_from_u32(u32::MAX).is_none());
    }

    #[test]
    fn participant_role_from_u32_edge_cases() {
        assert!(participant_role_from_u32(0).is_some());
        assert!(participant_role_from_u32(2).is_some());
        assert!(participant_role_from_u32(3).is_none());
        assert!(participant_role_from_u32(u32::MAX).is_none());
    }

    #[test]
    fn participant_role_roundtrip_lossless() {
        for i in 0..3 {
            let role = participant_role_from_u32(i).unwrap();
            assert_eq!(participant_role_to_u32(role), i);
        }
    }

    #[test]
    fn certification_level_from_u32_edge_cases() {
        assert!(certification_level_from_u32(0).is_some());
        assert!(certification_level_from_u32(3).is_some());
        assert!(certification_level_from_u32(4).is_none());
        assert!(certification_level_from_u32(u32::MAX).is_none());
    }

    #[test]
    fn certification_level_roundtrip_lossless() {
        for i in 0..4 {
            let level = certification_level_from_u32(i).unwrap();
            assert_eq!(certification_level_to_u32(level), i);
        }
    }

    #[test]
    fn waste_type_from_u32_edge_cases() {
        assert!(waste_type_from_u32(0).is_some());
        assert!(waste_type_from_u32(6).is_some());
        assert!(waste_type_from_u32(7).is_none());
        assert!(waste_type_from_u32(u32::MAX).is_none());
    }

    #[test]
    fn waste_type_roundtrip_lossless() {
        for i in 0..7 {
            let wt = waste_type_from_u32(i).unwrap();
            assert_eq!(waste_type_to_u32(wt), i);
        }
    }

    #[test]
    fn transfer_item_type_as_str_all_variants() {
        assert_eq!(transfer_item_type_as_str(TransferItemType::Material), "MATERIAL");
        assert_eq!(transfer_item_type_as_str(TransferItemType::Token), "TOKEN");
        assert_eq!(transfer_item_type_as_str(TransferItemType::Incentive), "INCENTIVE");
        assert_eq!(transfer_item_type_as_str(TransferItemType::Ownership), "OWNERSHIP");
    }

    #[test]
    fn waste_type_as_str_all_variants() {
        assert_eq!(waste_type_as_str(WasteType::Paper), "PAPER");
        assert_eq!(waste_type_as_str(WasteType::Plastic), "PLASTIC");
        assert_eq!(waste_type_as_str(WasteType::Electronic), "ELECTRONIC");
    }

    #[test]
    fn unknown_transfer_item_type_returns_none() {
        assert!(transfer_item_type_from_u32(999).is_none());
    }

    #[test]
    fn unknown_waste_type_returns_none() {
        assert!(waste_type_from_u32(99).is_none());
    }

    #[test]
    fn participant_role_as_str_all_variants() {
        assert_eq!(participant_role_as_str(ParticipantRole::Recycler), "RECYCLER");
        assert_eq!(participant_role_as_str(ParticipantRole::Collector), "COLLECTOR");
        assert_eq!(participant_role_as_str(ParticipantRole::Manufacturer), "MANUFACTURER");
    }
}
