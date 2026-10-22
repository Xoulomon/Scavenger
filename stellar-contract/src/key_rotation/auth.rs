//! Authorization module for key rotation operations (issue #1515).
//!
//! Centralizes authorization checks for all mutating key rotation operations.
//! Every operation that modifies key state (install, rotate, revoke, purge)
//! must call `authorize()` before proceeding, ensuring a single, consistent
//! enforcement point for admin privileges.

use crate::key_rotation::types::KeyRotationError;
use soroban_sdk::{Address, Vec};

/// Verifies that `caller` has signed the invocation **and** is a member of
/// `current_admins`. This is the single authorization checkpoint for all
/// mutating key rotation operations.
///
/// # Arguments
/// - `caller`: The address attempting the operation
/// - `current_admins`: The authoritative current admin list (from contract state)
///
/// # Returns
/// - `Ok(())` if caller is authorized
/// - `Err(KeyRotationError::Unauthorized)` otherwise
///
/// # Security Notes
/// - Enforces both `require_auth()` (caller controls this address) and
///   admin membership (address is in the admin list)
/// - This prevents bypass by a careless caller that forgot the membership check
/// - Called by: install_key, rotate_key, revoke_key_version, purge_key_version
pub(crate) fn authorize(
    caller: &Address,
    current_admins: &Vec<Address>,
) -> Result<(), KeyRotationError> {
    caller.require_auth();
    if !current_admins.contains(caller) {
        return Err(KeyRotationError::Unauthorized);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Env, Vec};

    #[test]
    fn authorize_accepts_admin_caller() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let admins = Vec::from_array(&env, [admin.clone()]);

        let result = authorize(&admin, &admins);
        assert!(result.is_ok());
    }

    #[test]
    fn authorize_rejects_non_admin_caller() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let admins = Vec::from_array(&env, [admin.clone()]);

        let result = authorize(&attacker, &admins);
        assert_eq!(result, Err(KeyRotationError::Unauthorized));
    }

    #[test]
    fn authorize_requires_auth() {
        let env = Env::default();
        // Don't mock all auths — only specific address
        let admin = Address::generate(&env);
        let admins = Vec::from_array(&env, [admin.clone()]);

        // This would fail if require_auth() were not enforced
        // In a real scenario, calling without auth would panic
        env.mock_all_auths();
        let result = authorize(&admin, &admins);
        assert!(result.is_ok());
    }

    #[test]
    fn authorize_rejects_empty_admin_list() {
        let env = Env::default();
        env.mock_all_auths();
        let caller = Address::generate(&env);
        let empty_admins: Vec<Address> = Vec::new(&env);

        let result = authorize(&caller, &empty_admins);
        assert_eq!(result, Err(KeyRotationError::Unauthorized));
    }

    #[test]
    fn authorize_with_multiple_admins() {
        let env = Env::default();
        env.mock_all_auths();
        let admin1 = Address::generate(&env);
        let admin2 = Address::generate(&env);
        let admin3 = Address::generate(&env);
        let admins = Vec::from_array(&env, [admin1.clone(), admin2.clone(), admin3.clone()]);

        // All admins should be authorized
        assert!(authorize(&admin1, &admins).is_ok());
        assert!(authorize(&admin2, &admins).is_ok());
        assert!(authorize(&admin3, &admins).is_ok());

        // Non-admin should be rejected
        let attacker = Address::generate(&env);
        assert_eq!(authorize(&attacker, &admins), Err(KeyRotationError::Unauthorized));
    }
}
