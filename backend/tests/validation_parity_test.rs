//! Cross-service validation parity tests (issue #1154).
//!
//! These fixtures mirror the TypeScript fixture set in
//! `packages/shared/src/validation-fixtures.ts`.  Any change to a rule must
//! update both files simultaneously.

use scavenger_backend::validation::{
    validate_stellar_address, validate_waste_weight, validate_coordinates,
};

// ── Stellar address ─────────────────────────────────────────────────────────

struct AddressFixture {
    address: &'static str,
    valid: bool,
    reason: &'static str,
}

const ADDRESS_FIXTURES: &[AddressFixture] = &[
    // Valid
    AddressFixture { address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN", valid: true, reason: "canonical 56-char base32 address" },
    AddressFixture { address: "GBSZ2TDIPF35RKRN7JDFBXJBF63EETXLYNUFU7P7KWZFRLPZORVBGQ3", valid: true, reason: "another valid address" },
    // Invalid – length
    AddressFixture { address: "GABC", valid: false, reason: "too short" },
    AddressFixture { address: "", valid: false, reason: "empty string" },
    // Invalid – charset
    // Note: Rust test builds these inline because const fn limitations
];

#[test]
fn stellar_address_parity() {
    for fixture in ADDRESS_FIXTURES {
        let result = validate_stellar_address(fixture.address);
        if fixture.valid {
            assert!(
                result.is_none(),
                "expected valid for '{}' ({}), got error",
                fixture.address,
                fixture.reason
            );
        } else {
            assert!(
                result.is_some(),
                "expected invalid for '{}' ({}), got None",
                fixture.address,
                fixture.reason
            );
        }
    }
}

#[test]
fn stellar_address_parity_charset() {
    // Characters NOT in Stellar base32 [A-Z2-7]
    let invalid_chars = ['0', '1', '8', '9', 'a', 'z'];
    for ch in &invalid_chars {
        let addr: String = std::iter::once('G').chain(std::iter::repeat(*ch).take(55)).collect();
        assert!(
            validate_stellar_address(&addr).is_some(),
            "'{}' with char '{}' should be rejected (not in base32)",
            addr,
            ch
        );
    }

    // Characters IN Stellar base32 [A-Z2-7]
    let valid_chars: Vec<char> = (b'A'..=b'Z').chain(b'2'..=b'7').map(|b| b as char).collect();
    for ch in &valid_chars {
        let addr: String = std::iter::once('G').chain(std::iter::repeat(*ch).take(55)).collect();
        assert!(
            validate_stellar_address(&addr).is_none(),
            "'{}' with valid char '{}' should be accepted",
            addr,
            ch
        );
    }
}

// ── Waste weight ─────────────────────────────────────────────────────────────

#[test]
fn waste_weight_parity() {
    struct WeightFixture { weight: u64, valid: bool, reason: &'static str }
    let fixtures = [
        WeightFixture { weight: 1, valid: true, reason: "minimum valid weight" },
        WeightFixture { weight: 500, valid: true, reason: "typical weight" },
        WeightFixture { weight: 1_000_000_000, valid: true, reason: "maximum valid weight" },
        WeightFixture { weight: 0, valid: false, reason: "zero is not allowed" },
        WeightFixture { weight: 1_000_000_001, valid: false, reason: "exceeds maximum" },
    ];
    for f in &fixtures {
        let result = validate_waste_weight(f.weight);
        if f.valid {
            assert!(result.is_none(), "expected valid for weight {} ({})", f.weight, f.reason);
        } else {
            assert!(result.is_some(), "expected invalid for weight {} ({})", f.weight, f.reason);
        }
    }
}

// ── Coordinates ──────────────────────────────────────────────────────────────

#[test]
fn coordinate_parity() {
    struct CoordFixture { lat: f64, lon: f64, valid: bool, reason: &'static str }
    let fixtures = [
        CoordFixture { lat: 0.0, lon: 0.0, valid: true, reason: "origin" },
        CoordFixture { lat: 90.0, lon: 180.0, valid: true, reason: "max boundary" },
        CoordFixture { lat: -90.0, lon: -180.0, valid: true, reason: "min boundary" },
        CoordFixture { lat: 91.0, lon: 0.0, valid: false, reason: "latitude above 90" },
        CoordFixture { lat: -91.0, lon: 0.0, valid: false, reason: "latitude below -90" },
        CoordFixture { lat: 0.0, lon: 181.0, valid: false, reason: "longitude above 180" },
        CoordFixture { lat: 0.0, lon: -181.0, valid: false, reason: "longitude below -180" },
        CoordFixture { lat: 91.0, lon: 181.0, valid: false, reason: "both out of range" },
    ];
    for f in &fixtures {
        let errors = validate_coordinates(f.lat, f.lon);
        if f.valid {
            assert!(errors.is_empty(), "expected valid for ({}, {}) ({})", f.lat, f.lon, f.reason);
        } else {
            assert!(!errors.is_empty(), "expected invalid for ({}, {}) ({})", f.lat, f.lon, f.reason);
        }
    }
}
