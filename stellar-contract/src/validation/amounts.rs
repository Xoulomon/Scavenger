/// Panics if `amount` is not positive (> 0).
#[allow(dead_code)]
pub fn validate_positive_amount(amount: i128, field_name: &str) {
    if amount <= 0 {
        panic!("{} must be greater than zero", field_name);
    }
}

/// Panics if a `u128` amount is zero.
pub fn validate_positive_u128(amount: u128, field_name: &str) {
    if amount == 0 {
        panic!("{} must be greater than zero", field_name);
    }
}

/// Validates that two reward-distribution percentages do not exceed 100.
pub fn validate_percentage_sum(collector_percentage: u32, owner_percentage: u32) {
    if collector_percentage > 100 || owner_percentage > 100 || collector_percentage + owner_percentage > 100 {
        panic!("Total percentages cannot exceed 100");
    }
}

/// Validates that collector and owner percentages together do not exceed 100.
pub fn validate_reward_percentages(collector_percentage: u32, owner_percentage: u32) {
    validate_percentage_sum(collector_percentage, owner_percentage);
}

/// Validates a non-negative i128 token amount (allows zero).
#[allow(dead_code)]
pub fn validate_non_negative(amount: i128, field_name: &str) {
    if amount < 0 {
        panic!("{} cannot be negative", field_name);
    }
}

/// Panics if `percentage` is greater than 100.
pub fn validate_percentage(percentage: u32, field_name: &str) {
    if percentage > 100 {
        panic!("{} must be <= 100", field_name);
    }
}

/// Validates a basis-point value (0–10 000 = 0%–100%).
#[allow(dead_code)]
pub fn validate_bps(bps: u32, field_name: &str) {
    if bps > 10_000 {
        panic!("{} must be <= 10 000 basis points", field_name);
    }
}
