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

// ─── Type size catalogue ──────────────────────────────────────────────────────

/// Byte-cost reference for XDR-serialised Soroban types.
///
/// Useful when estimating storage fees before invoking contract functions.
/// Values are the **minimum** XDR wire sizes; variable-length types (Address,
/// String, Vec) have additional per-element overhead.
pub struct TypeSizes;

impl TypeSizes {
    /// `bool` stored as a u32 discriminant: 4 bytes.
    pub const BOOL: u32 = 4;
    /// `u32` / `i32`: 4 bytes.
    pub const U32: u32 = 4;
    /// `u64` / `i64`: 8 bytes.
    pub const U64: u32 = 8;
    /// `u128` / `i128`: 16 bytes.
    pub const U128: u32 = 16;
    /// Stellar `Address` (G-account or contract): 32 bytes public key + 4 bytes discriminant.
    pub const ADDRESS: u32 = 36;
    /// `Symbol` (short, ≤9 chars): packed into a single u64 → 8 bytes.
    pub const SYMBOL_SHORT: u32 = 8;
    /// `String` base overhead (length prefix): 4 bytes + `len` bytes.
    pub const STRING_BASE: u32 = 4;

    /// Estimates the XDR byte cost of a `String` with a known byte length.
    pub fn string(len: u32) -> u32 {
        Self::STRING_BASE + len
    }

    /// Estimates the XDR byte cost of a `Vec<T>` where each element is `elem_size` bytes.
    pub fn vec(elem_size: u32, count: u32) -> u32 {
        // 4-byte length prefix + elements (XDR aligns to 4-byte boundary)
        4 + elem_size * count
    }
}

// ─── Packed boolean flags ─────────────────────────────────────────────────────

/// Bit-packed representation of the boolean fields on [`crate::types::Waste`].
///
/// Stores `is_active`, `is_frozen`, `is_confirmed`, and `is_contaminated` in a
/// single `u32` rather than four separate XDR values, saving ~12 bytes per
/// `Waste` entry.
///
/// # Layout
///
/// ```text
/// bit 0 — is_active
/// bit 1 — is_frozen
/// bit 2 — is_confirmed
/// bit 3 — is_contaminated
/// ```
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq, Default)]
pub struct PackedFlags(pub u32);

impl PackedFlags {
    pub const ACTIVE_BIT: u32 = 0;
    pub const FROZEN_BIT: u32 = 1;
    pub const CONFIRMED_BIT: u32 = 2;
    pub const CONTAMINATED_BIT: u32 = 3;

    /// Creates a `PackedFlags` from individual boolean values.
    pub fn new(is_active: bool, is_frozen: bool, is_confirmed: bool, is_contaminated: bool) -> Self {
        let mut v = 0u32;
        if is_active       { v |= 1 << Self::ACTIVE_BIT; }
        if is_frozen       { v |= 1 << Self::FROZEN_BIT; }
        if is_confirmed    { v |= 1 << Self::CONFIRMED_BIT; }
        if is_contaminated { v |= 1 << Self::CONTAMINATED_BIT; }
        Self(v)
    }

    /// Returns the value of a single bit.
    #[inline]
    pub fn get(&self, bit: u32) -> bool {
        (self.0 >> bit) & 1 == 1
    }

    /// Sets a bit to `value`.
    #[inline]
    pub fn set(&mut self, bit: u32, value: bool) {
        if value {
            self.0 |= 1 << bit;
        } else {
            self.0 &= !(1 << bit);
        }
    }

    pub fn is_active(&self) -> bool      { self.get(Self::ACTIVE_BIT) }
    pub fn is_frozen(&self) -> bool      { self.get(Self::FROZEN_BIT) }
    pub fn is_confirmed(&self) -> bool   { self.get(Self::CONFIRMED_BIT) }
    pub fn is_contaminated(&self) -> bool{ self.get(Self::CONTAMINATED_BIT) }

    pub fn set_active(&mut self, v: bool)       { self.set(Self::ACTIVE_BIT, v) }
    pub fn set_frozen(&mut self, v: bool)       { self.set(Self::FROZEN_BIT, v) }
    pub fn set_confirmed(&mut self, v: bool)    { self.set(Self::CONFIRMED_BIT, v) }
    pub fn set_contaminated(&mut self, v: bool) { self.set(Self::CONTAMINATED_BIT, v) }

    /// Returns the raw `u32` for serialisation.
    pub fn as_u32(&self) -> u32 { self.0 }

    /// Reconstructs from raw `u32`.
    pub fn from_u32(v: u32) -> Self { Self(v) }
}

// ─── Compressed coordinates ───────────────────────────────────────────────────

/// Losslessly packs a lat/lon pair (each stored as microdegrees, range
/// ±180_000_000 / ±90_000_000) into a single `u64`.
///
/// Encoding (big-endian):
/// ```text
/// bits 63-32 : lat + 90_000_000   (fits in 28 bits, stored in 32-bit high word)
/// bits 31-0  : lon + 180_000_000  (fits in 29 bits, stored in 32-bit low word)
/// ```
///
/// Total storage savings: 16 bytes (two `i128`) → 8 bytes (`u64`).
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CompressedCoords(pub u64);

impl CompressedCoords {
    const LAT_OFFSET: i128 = 90_000_000;
    const LON_OFFSET: i128 = 180_000_000;

    /// Packs `latitude` (microdegrees, −90e6..+90e6) and `longitude`
    /// (microdegrees, −180e6..+180e6) into a single `u64`.
    ///
    /// # Panics
    /// Panics if the coordinates are out of range.
    pub fn pack(latitude: i128, longitude: i128) -> Self {
        assert!(
            (-90_000_000..=90_000_000).contains(&latitude),
            "latitude out of range"
        );
        assert!(
            (-180_000_000..=180_000_000).contains(&longitude),
            "longitude out of range"
        );
        let lat_u = (latitude + Self::LAT_OFFSET) as u64;   // 0..180_000_000
        let lon_u = (longitude + Self::LON_OFFSET) as u64;  // 0..360_000_000
        Self((lat_u << 32) | lon_u)
    }

    /// Unpacks into `(latitude, longitude)` in microdegrees.
    pub fn unpack(&self) -> (i128, i128) {
        let lat_u = (self.0 >> 32) as i128;
        let lon_u = (self.0 & 0xFFFF_FFFF) as i128;
        (lat_u - Self::LAT_OFFSET, lon_u - Self::LON_OFFSET)
    }

    /// Convenience: returns latitude in microdegrees.
    pub fn latitude(&self) -> i128 { self.unpack().0 }

    /// Convenience: returns longitude in microdegrees.
    pub fn longitude(&self) -> i128 { self.unpack().1 }
}

// ─── Type validation helpers ──────────────────────────────────────────────────

/// Returns `true` if `role` is a valid [`crate::types::ParticipantRole`]
/// discriminant (0-2).
#[inline]
pub fn is_valid_role(role: u32) -> bool {
    role <= 2
}

/// Returns `true` if `waste_type` is a valid [`crate::types::WasteType`]
/// discriminant (0-6).
#[inline]
pub fn is_valid_waste_type(waste_type: u32) -> bool {
    waste_type <= 6
}

/// Returns `true` if `status` is a valid [`crate::types::ProcessingStatus`]
/// discriminant (0-4).
#[inline]
pub fn is_valid_processing_status(status: u32) -> bool {
    status <= 4
}

/// Returns `true` if `level` is a valid [`crate::types::CertificationLevel`]
/// discriminant (0-3).
#[inline]
pub fn is_valid_certification_level(level: u32) -> bool {
    level <= 3
}

/// Validates that `pct` is in [0, 100].
#[inline]
pub fn is_valid_percentage(pct: u32) -> bool {
    pct <= 100
}

/// Validates that contamination level is in [0, 100].
#[inline]
pub fn is_valid_contamination_level(level: u32) -> bool {
    level <= 100
}

/// Validates a composition slice: each entry in [0,100], all sum to exactly 100.
pub fn is_valid_composition(percentages: &[u32]) -> bool {
    if percentages.is_empty() {
        return false;
    }
    let mut sum: u32 = 0;
    for &p in percentages {
        if p > 100 { return false; }
        sum = sum.saturating_add(p);
    }
    sum == 100
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── TypeSizes ──────────────────────────────────────────────────────────────

    #[test]
    fn type_sizes_constants_are_sensible() {
        assert_eq!(TypeSizes::U64, 8);
        assert_eq!(TypeSizes::U128, 16);
        assert!(TypeSizes::ADDRESS > TypeSizes::U64);
    }

    #[test]
    fn type_sizes_string_adds_base_overhead() {
        assert_eq!(TypeSizes::string(10), TypeSizes::STRING_BASE + 10);
    }

    #[test]
    fn type_sizes_vec_calculation() {
        // 3 u64 elements: 4-byte prefix + 3*8 = 28
        assert_eq!(TypeSizes::vec(TypeSizes::U64, 3), 4 + 24);
    }

    // ── PackedFlags ────────────────────────────────────────────────────────────

    #[test]
    fn packed_flags_roundtrip() {
        let f = PackedFlags::new(true, false, true, false);
        assert!(f.is_active());
        assert!(!f.is_frozen());
        assert!(f.is_confirmed());
        assert!(!f.is_contaminated());
    }

    #[test]
    fn packed_flags_all_true() {
        let f = PackedFlags::new(true, true, true, true);
        assert_eq!(f.as_u32(), 0b1111);
    }

    #[test]
    fn packed_flags_all_false() {
        let f = PackedFlags::new(false, false, false, false);
        assert_eq!(f.as_u32(), 0);
    }

    #[test]
    fn packed_flags_set_individual_bit() {
        let mut f = PackedFlags::new(false, false, false, false);
        f.set_active(true);
        assert!(f.is_active());
        assert!(!f.is_frozen());
        f.set_active(false);
        assert!(!f.is_active());
    }

    #[test]
    fn packed_flags_from_u32_roundtrip() {
        let orig = PackedFlags::new(true, false, true, true);
        let rt = PackedFlags::from_u32(orig.as_u32());
        assert_eq!(orig, rt);
    }

    // ── CompressedCoords ───────────────────────────────────────────────────────

    #[test]
    fn compressed_coords_zero_roundtrip() {
        let c = CompressedCoords::pack(0, 0);
        assert_eq!(c.unpack(), (0, 0));
    }

    #[test]
    fn compressed_coords_max_roundtrip() {
        let c = CompressedCoords::pack(90_000_000, 180_000_000);
        assert_eq!(c.unpack(), (90_000_000, 180_000_000));
    }

    #[test]
    fn compressed_coords_min_roundtrip() {
        let c = CompressedCoords::pack(-90_000_000, -180_000_000);
        assert_eq!(c.unpack(), (-90_000_000, -180_000_000));
    }

    #[test]
    fn compressed_coords_berlin() {
        // Berlin: lat=52_520_000, lon=13_405_000 (microdegrees)
        let c = CompressedCoords::pack(52_520_000, 13_405_000);
        let (lat, lon) = c.unpack();
        assert_eq!(lat, 52_520_000);
        assert_eq!(lon, 13_405_000);
    }

    #[test]
    #[should_panic(expected = "latitude out of range")]
    fn compressed_coords_rejects_bad_lat() {
        CompressedCoords::pack(91_000_000, 0);
    }

    #[test]
    #[should_panic(expected = "longitude out of range")]
    fn compressed_coords_rejects_bad_lon() {
        CompressedCoords::pack(0, 181_000_000);
    }

    // ── Validation helpers ─────────────────────────────────────────────────────

    #[test]
    fn role_validation() {
        assert!(is_valid_role(0));
        assert!(is_valid_role(2));
        assert!(!is_valid_role(3));
    }

    #[test]
    fn waste_type_validation() {
        assert!(is_valid_waste_type(0));
        assert!(is_valid_waste_type(6));
        assert!(!is_valid_waste_type(7));
    }

    #[test]
    fn processing_status_validation() {
        assert!(is_valid_processing_status(0));
        assert!(is_valid_processing_status(4));
        assert!(!is_valid_processing_status(5));
    }

    #[test]
    fn certification_level_validation() {
        assert!(is_valid_certification_level(0));
        assert!(is_valid_certification_level(3));
        assert!(!is_valid_certification_level(4));
    }

    #[test]
    fn percentage_validation() {
        assert!(is_valid_percentage(0));
        assert!(is_valid_percentage(100));
        assert!(!is_valid_percentage(101));
    }

    #[test]
    fn contamination_level_validation() {
        assert!(is_valid_contamination_level(0));
        assert!(is_valid_contamination_level(100));
        assert!(!is_valid_contamination_level(101));
    }

    #[test]
    fn composition_validation_valid() {
        assert!(is_valid_composition(&[50, 30, 20]));
        assert!(is_valid_composition(&[100]));
    }

    #[test]
    fn composition_validation_invalid_sum() {
        assert!(!is_valid_composition(&[50, 30])); // 80 ≠ 100
    }

    #[test]
    fn composition_validation_empty() {
        assert!(!is_valid_composition(&[]));
    }
}
