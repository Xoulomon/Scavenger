use soroban_sdk::{Address, Env, Vec};

/// Panics if `address` equals the current contract address.
///
/// Use this to prevent participants from registering as the contract itself.
pub fn validate_address_not_contract(env: &Env, address: &Address) {
    if address == &env.current_contract_address() {
        panic!("Address cannot be the contract itself");
    }
}

/// Panics if `addr1` equals `addr2`.
pub fn validate_addresses_different(addr1: &Address, addr2: &Address, context: &str) {
    if addr1 == addr2 {
        panic!("{}: addresses must be different", context);
    }
}

/// Panics if `address` is not present in `allowed`.
#[allow(dead_code)]
pub fn validate_address_in_list(address: &Address, allowed: &Vec<Address>, context: &str) {
    if !allowed.contains(address) {
        panic!("{}: address not authorised", context);
    }
}
