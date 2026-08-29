#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{Error, ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

/// Boots a contract with an admin, a stellar-asset token, and the seller and
/// buyer pre-funded with that token. Seller is also pre-credited with
/// `seller_credits` carbon credits earned by verifying a plastic material
/// (1 g plastic = 2.5 g CO2e, so we choose weight accordingly).
fn setup_marketplace(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address) {
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let token = env.register_stellar_asset_contract_v2(admin.clone()).address();

    client.initialize_admin(&admin);
    client.set_token_address(&admin, &token);

    let seller = Address::generate(env);
    let buyer = Address::generate(env);
    client.register_participant(&seller, &ParticipantRole::Recycler, &symbol_short!("seller"), &0, &0);
    client.register_participant(&buyer, &ParticipantRole::Recycler, &symbol_short!("buyer"), &0, &0);

    // Mint tokens to the buyer so they can pay for listings.
    soroban_sdk::token::StellarAssetClient::new(env, &token).mint(&buyer, &1_000_000);

    // Earn 2 500 carbon credits for the seller (1 000 g plastic * 2.5).
    let desc = String::from_str(env, "test");
    let mat = client.submit_material(&WasteType::Plastic, &1_000, &seller, &desc);
    client.verify_material(&mat.id, &seller);

    (client, admin, seller, buyer)
}

// ── redeem_carbon_credits ─────────────────────────────────────────────────────

#[test]
fn test_redeem_decrements_balance() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    assert_eq!(client.get_participant_carbon_credits(&seller), 2_500);

    let remaining = client.redeem_carbon_credits(&seller, &1_000).unwrap();
    assert_eq!(remaining, 1_500);
    assert_eq!(client.get_participant_carbon_credits(&seller), 1_500);
}

#[test]
fn test_redeem_full_balance() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let remaining = client.redeem_carbon_credits(&seller, &2_500).unwrap();
    assert_eq!(remaining, 0);
    assert_eq!(client.get_participant_carbon_credits(&seller), 0);
}

#[test]
fn test_redeem_zero_amount_errors() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let r = client.try_redeem_carbon_credits(&seller, &0);
    assert_eq!(r, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn test_redeem_more_than_balance_errors() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let r = client.try_redeem_carbon_credits(&seller, &2_501);
    assert_eq!(r, Err(Ok(Error::InsufficientCarbonCredits)));
}

#[test]
fn test_redeem_without_stats_errors() {
    let env = Env::default();
    let (client, _admin, _seller, _buyer) = setup_marketplace(&env);

    let stranger = Address::generate(&env);
    let r = client.try_redeem_carbon_credits(&stranger, &1);
    assert_eq!(r, Err(Ok(Error::NotRegistered)));
}

#[test]
fn test_redeem_does_not_affect_global_total() {
    // Global TOTAL_CARBON is a lifetime counter; redemption is a participant-level
    // burn and intentionally does not decrement the global total.
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let total_before = client.get_total_carbon_credits();
    client.redeem_carbon_credits(&seller, &500).unwrap();
    assert_eq!(client.get_total_carbon_credits(), total_before);
}

// ── create_carbon_listing ─────────────────────────────────────────────────────

#[test]
fn test_create_listing_escrows_credits() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let id = client.create_carbon_listing(&seller, &1_000, &10).unwrap();

    let listing = client.get_carbon_listing(&id).unwrap();
    assert_eq!(listing.seller, seller);
    assert_eq!(listing.amount, 1_000);
    assert_eq!(listing.price_per_credit, 10);
    assert!(listing.is_active);

    // Seller's earned credits drop by the escrowed amount.
    assert_eq!(client.get_participant_carbon_credits(&seller), 1_500);
}

#[test]
fn test_create_listing_zero_amount_errors() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let r = client.try_create_carbon_listing(&seller, &0, &10);
    assert_eq!(r, Err(Ok(Error::InvalidListing)));
}

#[test]
fn test_create_listing_zero_price_errors() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let r = client.try_create_carbon_listing(&seller, &100, &0);
    assert_eq!(r, Err(Ok(Error::InvalidListing)));
}

#[test]
fn test_create_listing_insufficient_credits_errors() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let r = client.try_create_carbon_listing(&seller, &10_000, &1);
    assert_eq!(r, Err(Ok(Error::InsufficientCarbonCredits)));
}

#[test]
fn test_create_listing_without_stats_errors() {
    let env = Env::default();
    let (client, _admin, _seller, _buyer) = setup_marketplace(&env);

    let stranger = Address::generate(&env);
    let r = client.try_create_carbon_listing(&stranger, &10, &1);
    assert_eq!(r, Err(Ok(Error::NotRegistered)));
}

#[test]
fn test_create_multiple_listings_get_unique_ids() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let id1 = client.create_carbon_listing(&seller, &100, &1).unwrap();
    let id2 = client.create_carbon_listing(&seller, &200, &2).unwrap();
    assert_ne!(id1, id2);
}

// ── cancel_carbon_listing ─────────────────────────────────────────────────────

#[test]
fn test_cancel_returns_escrowed_credits() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let id = client.create_carbon_listing(&seller, &1_000, &10).unwrap();
    assert_eq!(client.get_participant_carbon_credits(&seller), 1_500);

    client.cancel_carbon_listing(&id, &seller).unwrap();
    assert_eq!(client.get_participant_carbon_credits(&seller), 2_500);

    let listing = client.get_carbon_listing(&id).unwrap();
    assert!(!listing.is_active);
}

#[test]
fn test_cancel_nonexistent_errors() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let r = client.try_cancel_carbon_listing(&9999u64, &seller);
    assert_eq!(r, Err(Ok(Error::CarbonListingNotFound)));
}

#[test]
fn test_cancel_already_inactive_errors() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let id = client.create_carbon_listing(&seller, &100, &1).unwrap();
    client.cancel_carbon_listing(&id, &seller).unwrap();

    let r = client.try_cancel_carbon_listing(&id, &seller);
    assert_eq!(r, Err(Ok(Error::CarbonListingInactive)));
}

#[test]
fn test_cancel_by_non_seller_errors() {
    let env = Env::default();
    let (client, _admin, seller, buyer) = setup_marketplace(&env);

    let id = client.create_carbon_listing(&seller, &100, &1).unwrap();
    let r = client.try_cancel_carbon_listing(&id, &buyer);
    assert_eq!(r, Err(Ok(Error::NotListingSeller)));
}

// ── purchase_carbon_listing ───────────────────────────────────────────────────

#[test]
fn test_purchase_transfers_credits_and_tokens() {
    let env = Env::default();
    let (client, _admin, seller, buyer) = setup_marketplace(&env);

    let id = client.create_carbon_listing(&seller, &1_000, &10).unwrap();

    let token_addr = client.get_token_address().unwrap();
    let token = soroban_sdk::token::TokenClient::new(&env, &token_addr);
    let buyer_before = token.balance(&buyer);
    let seller_before = token.balance(&seller);

    client.purchase_carbon_listing(&id, &buyer).unwrap();

    // Buyer paid 1_000 * 10 = 10_000.
    assert_eq!(token.balance(&buyer), buyer_before - 10_000);
    assert_eq!(token.balance(&seller), seller_before + 10_000);

    // Buyer gains the 1_000 carbon credits.
    assert_eq!(client.get_participant_carbon_credits(&buyer), 1_000);

    // Seller's earned credits do NOT increase further — the credits were
    // already escrowed at listing time, and the purchase transfers them out.
    assert_eq!(client.get_participant_carbon_credits(&seller), 1_500);

    let listing = client.get_carbon_listing(&id).unwrap();
    assert!(!listing.is_active);
}

#[test]
fn test_purchase_self_errors() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let id = client.create_carbon_listing(&seller, &100, &1).unwrap();
    let r = client.try_purchase_carbon_listing(&id, &seller);
    assert_eq!(r, Err(Ok(Error::InvalidListing)));
}

#[test]
fn test_purchase_nonexistent_errors() {
    let env = Env::default();
    let (client, _admin, _seller, buyer) = setup_marketplace(&env);

    let r = client.try_purchase_carbon_listing(&9999u64, &buyer);
    assert_eq!(r, Err(Ok(Error::CarbonListingNotFound)));
}

#[test]
fn test_purchase_inactive_errors() {
    let env = Env::default();
    let (client, _admin, seller, buyer) = setup_marketplace(&env);

    let id = client.create_carbon_listing(&seller, &100, &1).unwrap();
    client.cancel_carbon_listing(&id, &seller).unwrap();

    let r = client.try_purchase_carbon_listing(&id, &buyer);
    assert_eq!(r, Err(Ok(Error::CarbonListingInactive)));
}

#[test]
fn test_purchase_without_token_address_errors() {
    // Fresh contract with no token address configured.
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    client.register_participant(&seller, &ParticipantRole::Recycler, &symbol_short!("s"), &0, &0);
    client.register_participant(&buyer, &ParticipantRole::Recycler, &symbol_short!("b"), &0, &0);

    let desc = String::from_str(&env, "t");
    let mat = client.submit_material(&WasteType::Plastic, &1_000, &seller, &desc);
    client.verify_material(&mat.id, &seller);

    let id = client.create_carbon_listing(&seller, &100, &1).unwrap();
    let r = client.try_purchase_carbon_listing(&id, &buyer);
    assert_eq!(r, Err(Ok(Error::TokenAddressNotSet)));
}

// ── get_active_carbon_listings ────────────────────────────────────────────────

#[test]
fn test_active_listings_empty_initially() {
    let env = Env::default();
    let (client, _admin, _seller, _buyer) = setup_marketplace(&env);

    assert_eq!(client.get_active_carbon_listings().len(), 0);
}

#[test]
fn test_active_listings_excludes_cancelled() {
    let env = Env::default();
    let (client, _admin, seller, _buyer) = setup_marketplace(&env);

    let id1 = client.create_carbon_listing(&seller, &100, &1).unwrap();
    let _id2 = client.create_carbon_listing(&seller, &200, &2).unwrap();
    client.cancel_carbon_listing(&id1, &seller).unwrap();

    let active = client.get_active_carbon_listings();
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().amount, 200);
}

#[test]
fn test_active_listings_excludes_purchased() {
    let env = Env::default();
    let (client, _admin, seller, buyer) = setup_marketplace(&env);

    let id1 = client.create_carbon_listing(&seller, &100, &1).unwrap();
    let _id2 = client.create_carbon_listing(&seller, &200, &2).unwrap();
    client.purchase_carbon_listing(&id1, &buyer).unwrap();

    let active = client.get_active_carbon_listings();
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().amount, 200);
}
