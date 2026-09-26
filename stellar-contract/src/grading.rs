//! Consolidated grading logic for the Scavngr contract.
//!
//! This module consolidates all grading-related logic that was previously
//! scattered across `types.rs` (WasteGrade/WasteType methods) and `lib.rs`
//! (apply_grade_multiplier).
//!
//! # Grading Rules
//!
//! | Waste Type  | Min Grade | Rationale |
//! |-------------|-----------|-----------|
//! | Electronic  | B         | Safety and data-destruction compliance |
//! | Metal       | C         | Contamination tolerance moderate |
//! | Glass       | C         | Breakage and contaminant-free needed |
//! | PetPlastic  | C         | Food-contact reuse standards |
//! | Paper       | D         | Broad recyclability, lower quality OK |
//! | Plastic     | D         | General plastic stream tolerance |
//! | Organic     | D         | Composting accepts poor-condition material |
//!
//! # Grade Multipliers
//!
//! | Grade | Multiplier (pct) | Description |
//! |-------|------------------|-------------|
//! | A     | 150              | Excellent quality |
//! | B     | 120              | Good quality |
//! | C     | 100              | Average quality |
//! | D     | 70               | Poor quality |

use crate::types::{WasteGrade, WasteType};
use soroban_sdk::{Address, Env, Vec};

/// Apply the grade multiplier to a base reward: `base * grade.multiplier_pct() / 100`.
pub fn apply_grade_multiplier(base_reward: u64, grade: WasteGrade) -> u64 {
    base_reward * grade.multiplier_pct() / 100
}

/// Validate that a grade meets the minimum acceptable grade for a waste type.
pub fn grade_is_acceptable(grade: WasteGrade, waste_type: WasteType) -> bool {
    (grade as u32) <= (waste_type.min_acceptable_grade() as u32)
}

/// Get the minimum acceptable grade for a waste type.
pub fn min_acceptable_grade(waste_type: WasteType) -> WasteGrade {
    waste_type.min_acceptable_grade()
}

/// Record a grade for a waste item, updating grade history and grader stats.
///
/// This consolidates the grade recording logic from the public
/// `set_waste_grade` entry point into a reusable function.
pub fn record_grade(
    env: &Env,
    waste_id: u128,
    grade: WasteGrade,
    grader_address: &Address,
) {
    let history_key = ("grade_history", waste_id);
    let mut history: Vec<GradeRecord> = env
        .storage()
        .instance()
        .get(&history_key)
        .unwrap_or(Vec::new(env));
    history.push_back(GradeRecord {
        waste_id,
        grade,
        grader: grader_address.clone(),
        graded_at: env.ledger().timestamp(),
    });
    env.storage().instance().set(&history_key, &history);

    let stats_key = ("stats", grader_address.clone());
    let mut stats: crate::types::RecyclingStats = env
        .storage()
        .instance()
        .get(&stats_key)
        .unwrap_or_else(|| crate::types::RecyclingStats::new(grader_address.clone()));
    stats.record_grade(grade);
    env.storage().instance().set(&stats_key, &stats);
}

/// Convert a WasteGrade to its u32 discriminant.
pub fn grade_to_u32(grade: WasteGrade) -> u32 {
    grade as u32
}

/// Convert a u32 to a WasteGrade, if valid.
pub fn u32_to_grade(v: u32) -> Option<WasteGrade> {
    WasteGrade::from_u32(v)
}

/// Check if a grade value is valid (0-3).
pub fn is_valid_grade_value(v: u32) -> bool {
    WasteGrade::is_valid(v)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{WasteGrade, WasteType};

    #[test]
    fn test_apply_grade_multiplier() {
        assert_eq!(apply_grade_multiplier(100, WasteGrade::A), 150);
        assert_eq!(apply_grade_multiplier(100, WasteGrade::B), 120);
        assert_eq!(apply_grade_multiplier(100, WasteGrade::C), 100);
        assert_eq!(apply_grade_multiplier(100, WasteGrade::D), 70);
        assert_eq!(apply_grade_multiplier(0, WasteGrade::A), 0);
        assert_eq!(apply_grade_multiplier(1000, WasteGrade::A), 1500);
    }

    #[test]
    fn test_grade_is_acceptable() {
        assert!(grade_is_acceptable(WasteGrade::A, WasteType::Electronic));
        assert!(grade_is_acceptable(WasteGrade::B, WasteType::Electronic));
        assert!(!grade_is_acceptable(WasteGrade::C, WasteType::Electronic));
        assert!(grade_is_acceptable(WasteGrade::D, WasteType::Paper));
        assert!(grade_is_acceptable(WasteGrade::A, WasteType::Paper));
    }

    #[test]
    fn test_min_acceptable_grade() {
        assert_eq!(min_acceptable_grade(WasteType::Electronic), WasteGrade::B);
        assert_eq!(min_acceptable_grade(WasteType::Metal), WasteGrade::C);
        assert_eq!(min_acceptable_grade(WasteType::Paper), WasteGrade::D);
    }

    #[test]
    fn test_grade_to_u32_roundtrip() {
        assert_eq!(grade_to_u32(WasteGrade::A), 0);
        assert_eq!(grade_to_u32(WasteGrade::B), 1);
        assert_eq!(grade_to_u32(WasteGrade::C), 2);
        assert_eq!(grade_to_u32(WasteGrade::D), 3);
        assert_eq!(u32_to_grade(0), Some(WasteGrade::A));
        assert_eq!(u32_to_grade(3), Some(WasteGrade::D));
        assert_eq!(u32_to_grade(4), None);
    }

    #[test]
    fn test_is_valid_grade_value() {
        assert!(is_valid_grade_value(0));
        assert!(is_valid_grade_value(3));
        assert!(!is_valid_grade_value(4));
    }
}
