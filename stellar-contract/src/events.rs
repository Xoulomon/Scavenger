//! Contract event emitters.
//!
//! All events follow the pattern:
//!   `env.events().publish((TOPIC_SYMBOL, indexed_key), payload)`
//!
//! Symbols are ≤9 chars (Soroban limit). Payloads are tuples or scalars.

use soroban_sdk::{symbol_short, Address, Env, String, Symbol};

use crate::types::{CertificationLevel, ParticipantRole, ParticipantTier, WasteGrade, WasteType};

// ── Event topic symbols ───────────────────────────────────────────────────────
const WASTE_REGISTERED: Symbol = symbol_short!("recycled");
const DONATION_MADE: Symbol = symbol_short!("donated");
const WASTE_TRANSFERRED: Symbol = symbol_short!("transfer");
const WASTE_CONFIRMED: Symbol = symbol_short!("confirmed");
const PARTICIPANT_REGISTERED: Symbol = symbol_short!("reg");
const TOKENS_REWARDED: Symbol = symbol_short!("rewarded");
const ADMIN_TRANSFERRED: Symbol = symbol_short!("adm_xfr");
const CONTRACT_PAUSED: Symbol = symbol_short!("paused");
const CONTRACT_UNPAUSED: Symbol = symbol_short!("unpaused");
const INCENTIVE_UPDATED: Symbol = symbol_short!("inc_upd");
const BULK_TRANSFER: Symbol = symbol_short!("bulk_xfr");
const WASTE_CONFIRMATION_RESET: Symbol = symbol_short!("reset");
const WASTE_DEACTIVATED: Symbol = symbol_short!("deactive");
const CERTIFICATION_GRANTED: Symbol = symbol_short!("cert_gr");
const AUCTION_CREATED: Symbol = symbol_short!("auc_cre");
const BID_PLACED: Symbol = symbol_short!("bid_plc");
const AUCTION_ENDED: Symbol = symbol_short!("auc_end");
const BULK_IMPORT_COMPLETED: Symbol = symbol_short!("bulk_imp");

// ── Waste events ─────────────────────────────────────────────────────────────

/// Emitted when a new waste item is registered (v2 API).
pub fn emit_waste_registered(
    env: &Env,
    waste_id: u128,
    recycler: &Address,
    waste_type: WasteType,
    weight: u128,
    latitude: i128,
    longitude: i128,
) {
    env.events().publish(
        (WASTE_REGISTERED, waste_id),
        (waste_type, weight, recycler, latitude, longitude),
    );
}

/// Emitted when a v1 waste item is transferred (u64 waste ID).
pub fn emit_waste_transferred(env: &Env, waste_id: u64, from: &Address, to: &Address) {
    env.events().publish((WASTE_TRANSFERRED, waste_id), (from, to));
}

/// Emitted when a v2 waste item is transferred (u128 waste ID, includes timestamp).
pub fn emit_waste_transferred_v2(env: &Env, waste_id: u128, from: &Address, to: &Address, timestamp: u64) {
    env.events()
        .publish((WASTE_TRANSFERRED, waste_id), (from, to, timestamp));
}

/// Emitted when waste receipt is confirmed by a third party.
pub fn emit_waste_confirmed(env: &Env, waste_id: u128, confirmer: &Address) {
    env.events().publish((WASTE_CONFIRMED, waste_id), confirmer);
}

/// Emitted when a waste item's confirmation is reset by its owner.
pub fn emit_waste_confirmation_reset(env: &Env, waste_id: u128, owner: &Address, timestamp: u64) {
    env.events()
        .publish((WASTE_CONFIRMATION_RESET, waste_id), (owner, timestamp));
}

/// Emitted when a waste item is permanently deactivated.
pub fn emit_waste_deactivated(env: &Env, waste_id: u128, admin: &Address) {
    env.events()
        .publish((WASTE_DEACTIVATED, waste_id), (admin, env.ledger().timestamp()));
}

/// Emitted when a waste item expires and is cleaned up.
pub fn emit_waste_expired(env: &Env, waste_id: u128) {
    env.events()
        .publish((symbol_short!("expired"), waste_id), env.ledger().timestamp());
}

/// Emitted when a waste item is graded.
pub fn emit_waste_graded(env: &Env, waste_id: u128, grade: WasteGrade, grader: &Address) {
    env.events()
        .publish((symbol_short!("graded"), waste_id), (grade as u32, grader));
}

/// Emitted when a waste item is split into children.
pub fn emit_waste_split(env: &Env, waste_id: u128, owner: &Address, child_ids: &soroban_sdk::Vec<u128>) {
    env.events()
        .publish((symbol_short!("split"), waste_id), (owner, child_ids.len()));
}

/// Emitted when multiple waste items are merged.
pub fn emit_wastes_merged(env: &Env, merged_id: u128, owner: &Address, source_ids: &soroban_sdk::Vec<u128>) {
    env.events()
        .publish((symbol_short!("merged"), merged_id), (owner, source_ids.len()));
}

/// Emitted when a waste item is reserved.
pub fn emit_waste_reserved(env: &Env, waste_id: u128, reserver: &Address, until: u64) {
    env.events()
        .publish((symbol_short!("reserved"), waste_id), (reserver, until));
}

/// Emitted when a waste reservation is cancelled.
pub fn emit_reservation_cancelled(env: &Env, waste_id: u128, caller: &Address) {
    env.events().publish((symbol_short!("res_canc"), waste_id), caller);
}

/// Emitted when a waste item is marked contaminated.
pub fn emit_waste_contaminated(env: &Env, waste_id: u128, verifier: &Address, level: u32) {
    env.events()
        .publish((symbol_short!("contam"), waste_id), (verifier, level));
}

/// Emitted when a waste processing status changes.
pub fn emit_processing_status_changed(env: &Env, waste_id: u128, status: u32, caller: &Address, timestamp: u64) {
    env.events()
        .publish((symbol_short!("proc_upd"), waste_id), (caller, status, timestamp));
}

/// Emitted when a collector hands aggregated waste directly to a manufacturer.
pub fn emit_bulk_transfer(
    env: &Env,
    waste_id: u128,
    collector: &Address,
    manufacturer: &Address,
    waste_type: WasteType,
    timestamp: u64,
) {
    env.events().publish(
        (BULK_TRANSFER, waste_id),
        (collector, manufacturer, waste_type, timestamp),
    );
}

/// Emitted when an admin overrides a transfer.
pub fn emit_admin_override_transfer(env: &Env, waste_id: u128, admin: &Address, from: &Address, to: &Address) {
    env.events()
        .publish((symbol_short!("adm_xfr"), waste_id), (admin, from, to));
}

/// Emitted when waste composition is set.
pub fn emit_composition_set(env: &Env, waste_id: u128, verifier: &Address, entry_count: u32) {
    env.events()
        .publish((symbol_short!("comp_set"), waste_id), (verifier, entry_count));
}

// ── Participant events ────────────────────────────────────────────────────────

/// Emitted when a participant registers.
pub fn emit_participant_registered(
    env: &Env,
    address: &Address,
    role: ParticipantRole,
    name: Symbol,
    latitude: i128,
    longitude: i128,
) {
    env.events().publish(
        (PARTICIPANT_REGISTERED, address),
        (role.to_u32(), name, latitude, longitude),
    );
}

/// Emitted when a participant updates their location.
pub fn emit_participant_location_updated(env: &Env, address: &Address, latitude: i128, longitude: i128) {
    env.events()
        .publish((symbol_short!("loc_upd"), address), (latitude, longitude));
}

/// Emitted when a participant is granted a certification level.
pub fn emit_certification_granted(env: &Env, participant: &Address, level: CertificationLevel) {
    env.events()
        .publish((CERTIFICATION_GRANTED, participant), level.to_u32());
}

/// Emitted when a participant's tier changes.
pub fn emit_participant_tier_changed(
    env: &Env,
    participant: &Address,
    old_tier: ParticipantTier,
    new_tier: ParticipantTier,
) {
    env.events().publish(
        (symbol_short!("tier_upd"), participant),
        (old_tier as u32, new_tier as u32),
    );
}

// ── Token / reward events ─────────────────────────────────────────────────────

/// Emitted when tokens are rewarded to a participant.
pub fn emit_tokens_rewarded(env: &Env, recipient: &Address, amount: u128, waste_id: u128) {
    env.events().publish((TOKENS_REWARDED, recipient), (amount, waste_id));
}

/// Emitted when a donation is made to charity.
pub fn emit_donation_made(env: &Env, donor: &Address, amount: i128, charity_contract: &Address) {
    env.events().publish((DONATION_MADE, donor), (amount, charity_contract));
}

// ── Admin events ─────────────────────────────────────────────────────────────

/// Emitted when admin rights are transferred.
pub fn emit_admin_transferred(env: &Env, previous_admin: &Address) {
    env.events().publish((ADMIN_TRANSFERRED,), previous_admin);
}

/// Emitted when the contract is paused.
pub fn emit_contract_paused(env: &Env, admin: &Address) {
    env.events().publish((CONTRACT_PAUSED,), admin);
}

/// Emitted when the contract is unpaused.
pub fn emit_contract_unpaused(env: &Env, admin: &Address) {
    env.events().publish((CONTRACT_UNPAUSED,), admin);
}

/// Emitted when a multi-sig proposal is created.
pub fn emit_proposal_created(env: &Env, proposal_id: u64, proposer: &Address) {
    env.events().publish((symbol_short!("prop_new"), proposal_id), proposer);
}

/// Emitted when a multi-sig proposal is approved.
pub fn emit_proposal_approved(env: &Env, proposal_id: u64, approver: &Address) {
    env.events().publish((symbol_short!("prop_apr"), proposal_id), approver);
}

/// Emitted when a multi-sig proposal is executed.
pub fn emit_proposal_executed(env: &Env, proposal_id: u64, executor: &Address) {
    env.events().publish((symbol_short!("prop_exe"), proposal_id), executor);
}

// ── Incentive events ──────────────────────────────────────────────────────────

/// Emitted when an incentive's reward points or budget are updated.
pub fn emit_incentive_updated(
    env: &Env,
    incentive_id: u64,
    rewarder: &Address,
    new_reward_points: u64,
    new_total_budget: u64,
) {
    env.events().publish(
        (INCENTIVE_UPDATED, incentive_id),
        (rewarder, new_reward_points, new_total_budget),
    );
}

/// Emitted when an incentive's schedule is updated.
pub fn emit_incentive_scheduled(
    env: &Env,
    incentive_id: u64,
    rewarder: &Address,
    starts_at: Option<u64>,
    ends_at: Option<u64>,
) {
    env.events().publish(
        (symbol_short!("inc_sched"), incentive_id),
        (rewarder, starts_at, ends_at),
    );
}

// ── Seasonal multiplier events ────────────────────────────────────────────────

/// Emitted when the seasonal reward multiplier is updated.
pub fn emit_seasonal_multiplier_set(env: &Env, multiplier: u32, start: u64, end: u64) {
    env.events()
        .publish((symbol_short!("seas_set"),), (multiplier, start, end));
}

// ── Carbon credit events ──────────────────────────────────────────────────────

/// Emitted when carbon credits are earned through material verification.
pub fn emit_carbon_credits_earned(
    env: &Env,
    participant: &Address,
    waste_type: WasteType,
    weight: u128,
    credits: u128,
) {
    env.events()
        .publish((symbol_short!("carbon"), participant), (waste_type, weight, credits));
}

/// Emitted when a participant redeems carbon credits.
pub fn emit_carbon_credits_redeemed(env: &Env, participant: &Address, amount: u128, remaining: u128) {
    env.events()
        .publish((symbol_short!("carb_rdm"), participant), (amount, remaining));
}

/// Emitted when a carbon credit listing is created.
pub fn emit_carbon_listing_created(env: &Env, listing_id: u64, seller: &Address, amount: u128, price_per_credit: i128) {
    env.events().publish(
        (symbol_short!("carb_lst"), listing_id),
        (seller, amount, price_per_credit),
    );
}

/// Emitted when a carbon credit listing is cancelled.
pub fn emit_carbon_listing_cancelled(env: &Env, listing_id: u64, seller: &Address) {
    env.events().publish((symbol_short!("carb_cnc"), listing_id), seller);
}

/// Emitted when a carbon credit listing is purchased.
pub fn emit_carbon_listing_purchased(
    env: &Env,
    listing_id: u64,
    seller: &Address,
    buyer: &Address,
    amount: u128,
    total_price: i128,
) {
    env.events().publish(
        (symbol_short!("carb_buy"), listing_id),
        (seller, buyer, amount, total_price),
    );
}

// ── Auction events ────────────────────────────────────────────────────────────

/// Emitted when an auction is created.
pub fn emit_auction_created(
    env: &Env,
    auction_id: u64,
    waste_id: u128,
    creator: &Address,
    start_price: u128,
    end_time: u64,
) {
    env.events().publish(
        (AUCTION_CREATED, auction_id),
        (waste_id, creator, start_price, end_time),
    );
}

/// Emitted when a bid is placed in an auction.
pub fn emit_bid_placed(env: &Env, auction_id: u64, bidder: &Address, amount: u128) {
    env.events().publish((BID_PLACED, auction_id), (bidder, amount));
}

/// Emitted when an auction ends.
pub fn emit_auction_ended(env: &Env, auction_id: u64, winner: Option<&Address>, final_price: u128) {
    env.events().publish((AUCTION_ENDED, auction_id), (winner, final_price));
}

// ── Bulk import events ────────────────────────────────────────────────────────

/// Emitted when a bulk import operation completes.
pub fn emit_bulk_import_completed(env: &Env, item_type: &str, count: u32) {
    env.events().publish((BULK_IMPORT_COMPLETED,), (item_type, count));
}

// ── Goal / milestone events ───────────────────────────────────────────────────

/// Emitted when a participant achieves a recycling goal.
pub fn emit_goal_achieved(env: &Env, participant: &Address, target_weight: u128) {
    env.events()
        .publish((symbol_short!("goal_ach"), participant), target_weight);
}

// ── RBAC events (#704) ────────────────────────────────────────────────────────

/// Emitted when a permission is granted.
pub fn emit_permission_granted(env: &Env, subject: &Address, permission: u32, granted_by: &Address) {
    env.events()
        .publish((symbol_short!("perm_gr"), subject), (permission, granted_by));
}

/// Emitted when a permission is revoked.
pub fn emit_permission_revoked(env: &Env, subject: &Address, permission: u32, revoked_by: &Address) {
    env.events()
        .publish((symbol_short!("perm_rv"), subject), (permission, revoked_by));
}

// ── Reconciliation events (#706) ─────────────────────────────────────────────

/// Emitted when a waste item's weight is reconciled.
pub fn emit_waste_reconciled(
    env: &Env,
    waste_id: u128,
    original_weight: u128,
    adjusted_weight: u128,
    reconciled_by: &Address,
) {
    env.events().publish(
        (symbol_short!("reconcil"), waste_id),
        (original_weight, adjusted_weight, reconciled_by),
    );
}

// ── Batch processing events ───────────────────────────────────────────────────

/// Emitted when a waste batch is processed.
pub fn emit_batch_processed(env: &Env, batch_id: u64, processor: &Address, note: &String) {
    env.events()
        .publish((symbol_short!("batch_pr"), batch_id), (processor, note));
}
