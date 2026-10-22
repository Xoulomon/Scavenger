#![no_std]

// ── Core contract modules ─────────────────────────────────────────────────────
// #921: errors is the single shared error module — exported publicly so that
// callers, tests, and integration harnesses can reference Error variants
// without importing through lib.rs indirection.
mod analytics;
mod audit_log;
pub mod errors;
mod events;
#[cfg(feature = "debug")]
mod explorer;
mod query_optimizer;
mod storage_optimizer;
mod storage_utils;
mod types;
mod upgrade;
mod validation;
mod verification;
mod versioning;

// ── Issue #759: extracted functional modules ──────────────────────────────────
// Audited under issues #1097/#1100: `participant`, `waste`, and `incentive`
// are not currently called from any function in this file — `lib.rs` keeps
// its own inline implementation of the equivalent logic. Each module's own
// doc comment records what was verified (error handling, storage-key
// duplication, etc.) and why full rewiring is left as a follow-up.
/// On-chain aggregation helpers for stats and metrics (debug-only).
#[cfg(feature = "debug")]
pub mod contract_analytics;
/// Incentive creation, scheduling, and reward-claim helpers.
pub mod incentive;
/// Participant registration, role checks, and reputation helpers.
pub mod participant;
/// Waste lifecycle state guards and transfer-route validation.
pub mod waste;

// ── Issue #934: Participant storage consolidation ───────────────────────────
/// Centralized participant storage helpers, eliminating duplicates and providing
/// a single source of truth for all participant-related storage operations.
pub mod participant_storage;

// ── Issue #1101: Waste storage consolidation ─────────────────────────────────
/// Centralized waste storage helpers — mirrors `participant_storage`.
/// Owns all CRUD for `Waste` records, per-participant ID indices, and
/// transfer-history lists.  Business logic stays in `waste.rs`.
pub mod waste_storage;

// ── Issue #1102: Incentive storage consolidation ─────────────────────────────
/// Centralized incentive storage helpers — mirrors `participant_storage`.
/// Owns all CRUD for `Incentive` records and per-manufacturer ID indices.
/// Business logic (reward calc, scheduling) stays in `incentive.rs`.
pub mod incentive_storage;

// ── Issue #936: Batch operations gas optimizer ────────────────────────────────
/// Gas optimization for batch operations through consolidated storage writes.
/// Reduces per-item gas costs by batching participant updates and waste transfers.
pub mod batch_optimizer;

// ── Issue #937: Benchmark regression detection ────────────────────────────────
/// Performance baseline tracking and regression detection system.
/// Establishes baseline metrics and detects performance degradation over time.
pub mod benchmark_regression;

// ── Issues #814–#817: new utility modules ────────────────────────────────────
/// #814 — Reusable event builder pattern, filtering, and formatting utilities.
pub mod event_builder;
/// #817 — Versioned cryptographic key storage and rotation.
pub mod key_rotation;
/// #815 — Type size analysis, packed flags, coordinate compression, and validation.
pub mod type_utils;
/// #816 — Hash-based commitment scheme for privacy-preserving (ZKP-style) operations.
pub mod zkp;

// ── Issue #925: domain-split modules ─────────────────────────────────────────
/// Admin management: initialization, transfer, multisig proposals, pause/unpause.
pub mod admin;
/// Incentive programs: create, update, schedule, distribute, claim.
pub mod incentive_mgmt;
/// Participant registration, role management, location, reputation, leaderboard.
pub mod participant_mgmt;
/// Transfer workflows: initiate, approve, reject, expire pending transfers.
pub mod transfer_mgmt;
/// Waste lifecycle: submit, recycle, verify, transfer, split, merge, grade, tags.
pub mod waste_mgmt;

// ── Internal test modules (compile-time only) ─────────────────────────────────
#[path = "../../contracts/scavenger/src/test_edge_cases.rs"]
mod test_edge_cases_coverage;
mod test_expiration;
mod test_grading;
#[path = "../../contracts/scavenger/src/test_pause.rs"]
mod test_pause_coverage;
mod test_transfer_path_validation;

pub use errors::Error;
// Consolidated, deduplicated pub use block (fixes duplicate symbol exports)
pub use analytics::{AggregationType, AnalyticsDataPoint, AnalyticsEngine, AnalyticsReport, CustomQuery, ReportType};
#[cfg(feature = "debug")]
pub use explorer::{ExplorerConfig, TransactionStatus, TransactionTracker, TransactionType};
pub use types::calculate_carbon_credits;
pub use types::{
    Auction, BatchStatus, CarbonListing, CertificationLevel, Challenge, ChallengeProgress, ChallengeStatus,
    CollectionRoute, ComplianceReport, ComplianceStatus, ContaminationReport, Dispute, DisputeStatus, GlobalMetrics,
    GradeRecord, Incentive, LeaderboardEntry, LocationRecord, Material, MaterialComposition, Milestone,
    OptionalWasteType, ParticipantRole, PendingTransfer, PendingTransferStatus, PerformanceSnapshot,
    PermissionAuditEntry, PermissionType, ProcessingRecord, ProcessingStatus, QualityScore, ReconciliationRecord,
    RecyclingGoal, RecyclingStats, RegulatoryValidation, ReportPeriod, ReputationBadge, RouteStatus,
    SeasonalMultiplier, SubstitutionRecord, TransactionStats, TransferApproval, TransferApprovalStatus,
    TransferItemType, TransferRecord, TransferStatus, Waste, WasteBatch, WasteCertification, WasteGrade, WasteTransfer,
    WasteType,
};
pub use upgrade::{ProxyState, UpgradeHistory, UpgradeProposal, UpgradeStatus};
pub use verification::{VerificationRecord, VerificationState, VerificationWorkflow};

use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, Env, String, Symbol, Vec};

mod contract_domains;
mod contract_helpers;
mod contract_support;

pub use contract_support::{AdminAction, AdminProposal, Participant, ParticipantInfo, RewardConfig};
pub(crate) use contract_support::{
    ADMINS, AUCTION_COUNT, BATCH_COUNT, BATCH_INDEX, CARB_LIST_CNT, CARB_LIST_IDX, CERTIFICATIONS, CHALLENGE_COUNT,
    CHARITY, CONTAMINATED_LIST, DECAY_PER_DAY, DECAY_WINDOW_SECS, DISPUTE_CNT, LOCATION_HISTORY, MAX_ACTIVE_CHALLENGES,
    MAX_AUCTION_DURATION, MAX_WASTE_WEIGHT, MILESTONES_KEY, MILESTONE_THRESHOLDS, MIN_AUCTION_DURATION,
    MIN_BID_INCREMENT_PERCENT, MIN_WEIGHT, MULTISIG_THRESHOLD, PART_INDEX, PAUSED, PENDING_XFR_CNT, PERF_SNAPSHOTS,
    PERMISSIONS, PROPOSAL_COUNT, PROPOSAL_TTL_SECS, QUALITY_SCORES, RECONCIL_LOG, REENTRANCY_GUARD, REPORTS,
    REPORT_COUNT, REP_CONFIRM, REP_MAX, REP_MIN, REP_TRANSFER, REP_VERIFY, REQUIRED_APPROVERS, REWARD_CFG, ROUTE_CNT,
    SEASONAL_MUL, TOKEN_ADDR, TOTAL_CARBON, TOTAL_TOKENS, TOTAL_WEIGHT, TRANSACTION_STATS, TRANSFER_APPROVALS,
    TRANSFER_EXPIRY_SECS, TRANSFER_THRESHOLD,
};

#[contract]
pub struct ScavengerContract;

// Keep the forwarding-only interface compact; implementations live in domain modules.
#[rustfmt::skip]
#[contractimpl]
impl ScavengerContract {
    pub fn initialize_admin(env: Env, admin: Address) {
        contract_domains::admin::initialize_admin(env, admin)
    }
    pub fn get_admins(env: Env) -> Vec<Address> {
        contract_domains::admin::get_admins(env)
    }
    pub fn get_admin(env: Env) -> Address {
        contract_domains::admin::get_admin(env)
    }
    pub fn transfer_admin(env: Env, current_admin: Address, new_admins: Vec<Address>) {
        contract_domains::admin::transfer_admin(env, current_admin, new_admins)
    }
    pub fn add_admin(env: Env, current_admin: Address, new_admin: Address) {
        contract_domains::admin::add_admin(env, current_admin, new_admin)
    }
    pub fn remove_admin(env: Env, current_admin: Address, admin_to_remove: Address) {
        contract_domains::admin::remove_admin(env, current_admin, admin_to_remove)
    }
    pub fn set_charity_contract(env: Env, admin: Address, charity_address: Address) {
        contract_domains::admin::set_charity_contract(env, admin, charity_address)
    }
    pub fn get_charity_contract(env: Env) -> Option<Address> {
        contract_domains::admin::get_charity_contract(env)
    }
    pub fn donate_to_charity(env: Env, donor: Address, amount: i128) {
        contract_domains::admin::donate_to_charity(env, donor, amount)
    }
    pub fn set_percentages(env: Env, admin: Address, collector_percentage: u32, owner_percentage: u32) {
        contract_domains::admin::set_percentages(env, admin, collector_percentage, owner_percentage)
    }
    pub fn get_collector_percentage(env: Env) -> Option<u32> {
        contract_domains::admin::get_collector_percentage(env)
    }
    pub fn get_owner_percentage(env: Env) -> Option<u32> {
        contract_domains::admin::get_owner_percentage(env)
    }
    pub fn set_collector_percentage(env: Env, admin: Address, new_percentage: u32) {
        contract_domains::admin::set_collector_percentage(env, admin, new_percentage)
    }
    pub fn set_owner_percentage(env: Env, admin: Address, new_percentage: u32) {
        contract_domains::admin::set_owner_percentage(env, admin, new_percentage)
    }
    pub fn set_min_weight(env: Env, admin: Address, min_weight: u128) {
        contract_domains::admin::set_min_weight(env, admin, min_weight)
    }
    pub fn get_min_weight(env: Env) -> u128 {
        contract_domains::admin::get_min_weight(env)
    }
    pub fn set_token_address(env: Env, admin: Address, token_address: Address) {
        contract_domains::admin::set_token_address(env, admin, token_address)
    }
    pub fn get_token_address(env: Env) -> Option<Address> {
        contract_domains::admin::get_token_address(env)
    }
    pub fn set_seasonal_multiplier(env: Env, admin: Address, multiplier: u32, start: u64, end: u64) {
        contract_domains::admin::set_seasonal_multiplier(env, admin, multiplier, start, end)
    }
    pub fn get_current_multiplier(env: Env) -> u32 {
        contract_domains::admin::get_current_multiplier(env)
    }
    pub fn reward_tokens(env: Env, rewarder: Address, recipient: Address, amount: i128, waste_id: u64) {
        contract_domains::incentive::reward_tokens(env, rewarder, recipient, amount, waste_id)
    }
    pub fn is_participant_registered(env: Env, address: Address) -> bool {
        contract_domains::participant::is_participant_registered(env, address)
    }
    pub fn register_participant( env: Env, address: Address, role: ParticipantRole, name: soroban_sdk::Symbol, latitude: i128, longitude: i128, ) -> Participant {
        contract_domains::participant::register_participant(env, address, role, name, latitude, longitude)
    }
    pub fn waste_exists(env: Env, waste_id: u64) -> bool {
        contract_domains::waste::waste_exists(env, waste_id)
    }
    pub fn get_waste_type_string(env: Env, waste_type: WasteType) -> String {
        contract_domains::waste::get_waste_type_string(env, waste_type)
    }
    pub fn get_participant_role_string(env: Env, role: ParticipantRole) -> String {
        contract_domains::waste::get_participant_role_string(env, role)
    }
    pub fn is_valid_transfer(env: &Env, from: Address, to: Address) -> bool {
        contract_domains::transfer::is_valid_transfer(env, from, to)
    }
    pub fn validate_transfer_path(env: Env, waste_id: u128, from: Address, to: Address) -> Result<(), Error> {
        contract_domains::transfer::validate_transfer_path(env, waste_id, from, to)
    }
    pub fn admin_override_transfer( env: Env, admin: Address, waste_id: u128, from: Address, to: Address, latitude: i128, longitude: i128, ) -> Result<WasteTransfer, Error> {
        contract_domains::transfer::admin_override_transfer(env, admin, waste_id, from, to, latitude, longitude)
    }
    pub fn get_transfer_path_data(env: Env, waste_id: u128) -> Vec<WasteTransfer> {
        contract_domains::transfer::get_transfer_path_data(env, waste_id)
    }
    pub fn incentive_exists(env: Env, incentive_id: u64) -> bool {
        contract_domains::incentive::incentive_exists(env, incentive_id)
    }
    pub fn get_incentive_by_id(env: Env, incentive_id: u64) -> Option<Incentive> {
        contract_domains::incentive::get_incentive_by_id(env, incentive_id)
    }
    pub fn update_incentive_status(env: Env, incentive_id: u64, is_active: bool) -> Incentive {
        contract_domains::incentive::update_incentive_status(env, incentive_id, is_active)
    }
    pub fn update_incentive(env: Env, incentive_id: u64, new_reward_points: u64, new_total_budget: u64) -> Incentive {
        contract_domains::incentive::update_incentive(env, incentive_id, new_reward_points, new_total_budget)
    }
    pub fn calculate_incentive_reward(env: Env, incentive_id: u64, waste_amount: u64) -> u64 {
        contract_domains::incentive::calculate_incentive_reward(env, incentive_id, waste_amount)
    }
    pub fn get_incentives_by_waste_type(env: Env, waste_type: WasteType) -> soroban_sdk::Vec<Incentive> {
        contract_domains::incentive::get_incentives_by_waste_type(env, waste_type)
    }
    pub fn get_incentives(env: Env, waste_type: WasteType) -> soroban_sdk::Vec<Incentive> {
        contract_domains::incentive::get_incentives(env, waste_type)
    }
    pub fn get_active_incentives(env: Env) -> soroban_sdk::Vec<Incentive> {
        contract_domains::incentive::get_active_incentives(env)
    }
    pub fn get_participant(env: Env, address: Address) -> Option<Participant> {
        contract_domains::participant::get_participant(env, address)
    }
    pub fn get_participant_earnings(env: Env, address: Address) -> i128 {
        contract_domains::participant::get_participant_earnings(env, address)
    }
    pub fn get_participant_info(env: Env, address: Address) -> Option<ParticipantInfo> {
        contract_domains::participant::get_participant_info(env, address)
    }
    pub fn get_all_participants(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        contract_domains::participant::get_all_participants(env, offset, limit)
    }
    pub fn grant_certification(env: Env, admin: Address, address: Address, level: CertificationLevel) {
        contract_domains::participant::grant_certification(env, admin, address, level)
    }
    pub fn get_participants_by_cert(env: Env, level: CertificationLevel) -> Vec<Address> {
        contract_domains::participant::get_participants_by_cert(env, level)
    }
    pub fn create_auction(env: Env, creator: Address, waste_id: u128, start_price: u128, duration: u64) -> u64 {
        contract_domains::transfer::create_auction(env, creator, waste_id, start_price, duration)
    }
    pub fn place_bid(env: Env, bidder: Address, auction_id: u64, amount: u128) {
        contract_domains::transfer::place_bid(env, bidder, auction_id, amount)
    }
    pub fn end_auction(env: Env, auction_id: u64) {
        contract_domains::transfer::end_auction(env, auction_id)
    }
    pub fn cancel_auction(env: Env, caller: Address, auction_id: u64) {
        contract_domains::transfer::cancel_auction(env, caller, auction_id)
    }
    pub fn get_waste_by_tracking_code(env: Env, code: soroban_sdk::String) -> Option<types::Waste> {
        contract_domains::waste::get_waste_by_tracking_code(env, code)
    }
    pub fn bulk_import_wastes(env: Env, admin: Address, wastes: soroban_sdk::Vec<types::Waste>) {
        contract_domains::waste::bulk_import_wastes(env, admin, wastes)
    }
    pub fn bulk_import_participants(env: Env, admin: Address, participants: soroban_sdk::Vec<Participant>) {
        contract_domains::participant::bulk_import_participants(env, admin, participants)
    }
    pub fn update_role(env: Env, address: Address, new_role: ParticipantRole) -> Participant {
        contract_domains::participant::update_role(env, address, new_role)
    }
    pub fn deregister_participant(env: Env, address: Address) -> Participant {
        contract_domains::participant::deregister_participant(env, address)
    }
    pub fn update_participant_location(env: Env, address: Address, latitude: i128, longitude: i128) -> Participant {
        contract_domains::participant::update_participant_location(env, address, latitude, longitude)
    }
    pub fn update_location(env: Env, address: Address, latitude: i128, longitude: i128) -> Participant {
        contract_domains::participant::update_location(env, address, latitude, longitude)
    }
    pub fn get_transfer_history(env: Env, waste_id: u64) -> Vec<WasteTransfer> {
        contract_domains::transfer::get_transfer_history(env, waste_id)
    }
    pub fn get_waste_transfer_history(env: Env, waste_id: u64) -> Vec<WasteTransfer> {
        contract_domains::transfer::get_waste_transfer_history(env, waste_id)
    }
    pub fn get_waste_transfer_history_v2(env: Env, waste_id: u128) -> Vec<WasteTransfer> {
        contract_domains::transfer::get_waste_transfer_history_v2(env, waste_id)
    }
    pub fn transfer_waste(env: Env, waste_id: u64, from: Address, to: Address, note: String) -> Material {
        contract_domains::transfer::transfer_waste(env, waste_id, from, to, note)
    }
    pub fn get_transfers_from(env: Env, _address: Address) -> Vec<(u64, Vec<WasteTransfer>)> {
        contract_domains::transfer::get_transfers_from(env, _address)
    }
    pub fn get_transfers_to(env: Env, _address: Address) -> Vec<(u64, Vec<WasteTransfer>)> {
        contract_domains::transfer::get_transfers_to(env, _address)
    }
    pub fn can_collect(env: Env, address: Address) -> bool {
        contract_domains::participant::can_collect(env, address)
    }
    pub fn can_manufacture(env: Env, address: Address) -> bool {
        contract_domains::participant::can_manufacture(env, address)
    }
    pub fn submit_material( env: Env, waste_type: WasteType, weight: u64, submitter: Address, description: String, ) -> Material {
        contract_domains::waste::submit_material(env, waste_type, weight, submitter, description)
    }
    pub fn recycle_waste( env: Env, waste_type: WasteType, weight: u128, recycler: Address, latitude: i128, longitude: i128, ) -> u128 {
        contract_domains::waste::recycle_waste(env, waste_type, weight, recycler, latitude, longitude)
    }
    pub fn get_waste_v2(env: Env, waste_id: u128) -> Option<types::Waste> {
        contract_domains::waste::get_waste_v2(env, waste_id)
    }
    pub fn get_participant_wastes_v2(env: Env, participant: Address) -> Vec<u128> {
        contract_domains::participant::get_participant_wastes_v2(env, participant)
    }
    pub fn update_processing_status( env: Env, waste_id: u128, caller: Address, new_status: ProcessingStatus, ) -> types::Waste {
        contract_domains::waste::update_processing_status(env, waste_id, caller, new_status)
    }
    pub fn get_wastes_by_status(env: Env, status: ProcessingStatus) -> Vec<u128> {
        contract_domains::waste::get_wastes_by_status(env, status)
    }
    pub fn transfer_waste_v2( env: Env, waste_id: u128, from: Address, to: Address, latitude: i128, longitude: i128, ) -> Result<WasteTransfer, Error> {
        contract_domains::transfer::transfer_waste_v2(env, waste_id, from, to, latitude, longitude)
    }
    pub fn batch_transfer_waste( env: Env, waste_ids: Vec<u128>, to: Address, latitude: i128, longitude: i128, ) -> Result<Vec<WasteTransfer>, Error> {
        contract_domains::transfer::batch_transfer_waste(env, waste_ids, to, latitude, longitude)
    }
    pub fn transfer_collected_waste( env: Env, waste_type: WasteType, collector: Address, manufacturer: Address, latitude: i128, longitude: i128, notes: soroban_sdk::Symbol, ) -> u128 {
        contract_domains::transfer::transfer_collected_waste( env, waste_type, collector, manufacturer, latitude, longitude, notes, )
    }
    pub fn confirm_waste_details(env: Env, waste_id: u128, confirmer: Address) -> types::Waste {
        contract_domains::waste::confirm_waste_details(env, waste_id, confirmer)
    }
    pub fn reset_waste_confirmation(env: Env, waste_id: u128, owner: Address) -> types::Waste {
        contract_domains::waste::reset_waste_confirmation(env, waste_id, owner)
    }
    pub fn deactivate_waste(env: Env, waste_id: u128, admin: Address) -> types::Waste {
        contract_domains::waste::deactivate_waste(env, waste_id, admin)
    }
    pub fn batch_deactivate_waste(env: Env, waste_ids: Vec<u128>, admin: Address) -> u32 {
        contract_domains::waste::batch_deactivate_waste(env, waste_ids, admin)
    }
    pub fn set_waste_ttl(env: Env, admin: Address, waste_type: WasteType, ttl_seconds: u64) {
        contract_domains::waste::set_waste_ttl(env, admin, waste_type, ttl_seconds)
    }
    pub fn get_waste_ttl(env: Env, waste_type: WasteType) -> u64 {
        contract_domains::waste::get_waste_ttl(env, waste_type)
    }
    pub fn get_expired_wastes(env: Env) -> Vec<u128> {
        contract_domains::waste::get_expired_wastes(env)
    }
    pub fn cleanup_expired_wastes(env: Env, admin: Address) -> u32 {
        contract_domains::waste::cleanup_expired_wastes(env, admin)
    }
    pub fn check_waste_expiration(env: Env, waste_id: u128) -> bool {
        contract_domains::waste::check_waste_expiration(env, waste_id)
    }
    pub fn get_wastes_approaching_expiry(env: Env, within_seconds: u64) -> Vec<u128> {
        contract_domains::waste::get_wastes_approaching_expiry(env, within_seconds)
    }
    pub fn get_lifecycle_summary(env: Env) -> (u64, u64) {
        contract_domains::analytics::get_lifecycle_summary(env)
    }
    pub fn submit_materials_batch( env: Env, materials: soroban_sdk::Vec<(WasteType, u64, String)>, submitter: Address, ) -> soroban_sdk::Vec<Material> {
        contract_domains::waste::submit_materials_batch(env, materials, submitter)
    }
    pub fn get_material(env: Env, material_id: u64) -> Option<Material> {
        contract_domains::waste::get_material(env, material_id)
    }
    pub fn get_waste_by_id(env: Env, waste_id: u64) -> Option<Material> {
        contract_domains::waste::get_waste_by_id(env, waste_id)
    }
    pub fn get_waste(env: Env, waste_id: u64) -> Option<Material> {
        contract_domains::waste::get_waste(env, waste_id)
    }
    pub fn get_participant_wastes(env: Env, participant: Address) -> Vec<u64> {
        contract_domains::participant::get_participant_wastes(env, participant)
    }
    pub fn get_wastes_batch(env: Env, waste_ids: soroban_sdk::Vec<u64>) -> soroban_sdk::Vec<Option<Material>> {
        contract_domains::waste::get_wastes_batch(env, waste_ids)
    }
    pub fn verify_material(env: Env, material_id: u64, verifier: Address) -> Material {
        contract_domains::verification::verify_material(env, material_id, verifier)
    }
    pub fn verify_materials_batch( env: Env, material_ids: soroban_sdk::Vec<u64>, verifier: Address, ) -> soroban_sdk::Vec<Material> {
        contract_domains::verification::verify_materials_batch(env, material_ids, verifier)
    }
    pub fn get_stats(env: Env, participant: Address) -> Option<RecyclingStats> {
        contract_domains::analytics::get_stats(env, participant)
    }
    pub fn calculate_carbon_credits(waste_type: WasteType, weight_grams: u128) -> u128 {
        contract_domains::analytics::calculate_carbon_credits(waste_type, weight_grams)
    }
    pub fn get_total_carbon_credits(env: Env) -> u128 {
        contract_domains::analytics::get_total_carbon_credits(env)
    }
    pub fn get_participant_carbon_credits(env: Env, participant: Address) -> u128 {
        contract_domains::analytics::get_participant_carbon_credits(env, participant)
    }
    pub fn redeem_carbon_credits(env: Env, participant: Address, amount: u128) -> Result<u128, Error> {
        contract_domains::incentive::redeem_carbon_credits(env, participant, amount)
    }
    pub fn create_carbon_listing( env: Env, seller: Address, amount: u128, price_per_credit: i128, ) -> Result<u64, Error> {
        contract_domains::incentive::create_carbon_listing(env, seller, amount, price_per_credit)
    }
    pub fn cancel_carbon_listing(env: Env, listing_id: u64, seller: Address) -> Result<(), Error> {
        contract_domains::incentive::cancel_carbon_listing(env, listing_id, seller)
    }
    pub fn purchase_carbon_listing(env: Env, listing_id: u64, buyer: Address) -> Result<(), Error> {
        contract_domains::incentive::purchase_carbon_listing(env, listing_id, buyer)
    }
    pub fn get_carbon_listing(env: Env, listing_id: u64) -> Option<CarbonListing> {
        contract_domains::incentive::get_carbon_listing(env, listing_id)
    }
    pub fn get_active_carbon_listings(env: Env) -> Vec<CarbonListing> {
        contract_domains::incentive::get_active_carbon_listings(env)
    }
    pub fn mark_contaminated(env: Env, waste_id: u128, verifier: Address, level: u32, reason: String) -> types::Waste {
        contract_domains::verification::mark_contaminated(env, waste_id, verifier, level, reason)
    }
    pub fn get_contaminated_wastes(env: Env) -> Vec<u128> {
        contract_domains::verification::get_contaminated_wastes(env)
    }
    pub fn get_contamination_score(env: Env, waste_id: u128) -> u32 {
        contract_domains::verification::get_contamination_score(env, waste_id)
    }
    pub fn report_contamination( env: Env, waste_id: u128, reporter: Address, level: u32, reason: String, ) -> types::ContaminationReport {
        contract_domains::verification::report_contamination(env, waste_id, reporter, level, reason)
    }
    pub fn get_contamination_reports(env: Env, waste_id: u128) -> Vec<types::ContaminationReport> {
        contract_domains::verification::get_contamination_reports(env, waste_id)
    }
    pub fn batch_submit_materials( env: Env, materials: soroban_sdk::Vec<(WasteType, u64, String)>, submitter: Address, ) -> soroban_sdk::Vec<Material> {
        contract_domains::waste::batch_submit_materials(env, materials, submitter)
    }
    pub fn batch_verify_materials( env: Env, material_ids: soroban_sdk::Vec<u64>, verifier: Address, ) -> soroban_sdk::Vec<Material> {
        contract_domains::verification::batch_verify_materials(env, material_ids, verifier)
    }
    pub fn get_supply_chain_stats(env: Env) -> (u64, u64, u128) {
        contract_domains::analytics::get_supply_chain_stats(env)
    }
    pub fn get_incentives_by_rewarder(env: Env, rewarder: Address) -> Vec<Incentive> {
        contract_domains::incentive::get_incentives_by_rewarder(env, rewarder)
    }
    pub fn get_active_mfr_incentive(env: Env, manufacturer: Address, waste_type: WasteType) -> Option<Incentive> {
        contract_domains::incentive::get_active_mfr_incentive(env, manufacturer, waste_type)
    }
    pub fn create_incentive( env: Env, rewarder: Address, waste_type: WasteType, reward_points: u64, total_budget: u64, ) -> Incentive {
        contract_domains::incentive::create_incentive(env, rewarder, waste_type, reward_points, total_budget)
    }
    pub fn claim_incentive_reward( env: Env, incentive_id: u64, material_id: u64, claimer: Address, ) -> Result<i128, Error> {
        contract_domains::incentive::claim_incentive_reward(env, incentive_id, material_id, claimer)
    }
    pub fn deactivate_incentive(env: Env, incentive_id: u64, rewarder: Address) -> Incentive {
        contract_domains::incentive::deactivate_incentive(env, incentive_id, rewarder)
    }
    pub fn set_waste_grade(env: Env, waste_id: u128, grade: WasteGrade, grader: Address) -> types::Waste {
        contract_domains::verification::set_waste_grade(env, waste_id, grade, grader)
    }
    pub fn get_grade_history(env: Env, waste_id: u128) -> Vec<types::GradeRecord> {
        contract_domains::verification::get_grade_history(env, waste_id)
    }
    pub fn get_wastes_by_grade(env: Env, grade: WasteGrade) -> Vec<u128> {
        contract_domains::verification::get_wastes_by_grade(env, grade)
    }
    pub fn apply_grade_multiplier(base_reward: u64, grade: WasteGrade) -> u64 {
        contract_domains::verification::apply_grade_multiplier(base_reward, grade)
    }
    pub fn get_grading_analytics(env: Env) -> (u64, u64, u64, u64) {
        contract_domains::analytics::get_grading_analytics(env)
    }
    pub fn set_waste_grade_ai_verified( env: Env, waste_id: u128, grade: WasteGrade, grader: Address, ai_confidence: u32, ) -> Result<types::Waste, Error> {
        contract_domains::verification::set_waste_grade_ai_verified(env, waste_id, grade, grader, ai_confidence)
    }
    pub fn get_ai_grade_confidence(env: Env, waste_id: u128) -> Option<u32> {
        contract_domains::verification::get_ai_grade_confidence(env, waste_id)
    }
    pub fn add_waste_tag(env: Env, waste_id: u128, tag: String, caller: Address) -> types::Waste {
        contract_domains::waste::add_waste_tag(env, waste_id, tag, caller)
    }
    pub fn remove_waste_tag(env: Env, waste_id: u128, tag: String, caller: Address) -> types::Waste {
        contract_domains::waste::remove_waste_tag(env, waste_id, tag, caller)
    }
    pub fn get_wastes_by_tag(env: Env, tag: String) -> Vec<u128> {
        contract_domains::waste::get_wastes_by_tag(env, tag)
    }
    pub fn set_waste_image(env: Env, waste_id: u128, hash: String, caller: Address) -> types::Waste {
        contract_domains::waste::set_waste_image(env, waste_id, hash, caller)
    }
    pub fn add_waste_document(env: Env, waste_id: u128, hash: String, caller: Address) -> types::Waste {
        contract_domains::waste::add_waste_document(env, waste_id, hash, caller)
    }
    pub fn set_multisig_threshold(env: Env, admin: Address, threshold: u32) {
        contract_domains::admin::set_multisig_threshold(env, admin, threshold)
    }
    pub fn get_multisig_threshold(env: Env) -> u32 {
        contract_domains::admin::get_multisig_threshold(env)
    }
    pub fn propose_admin_action(env: Env, proposer: Address, action: AdminAction) -> AdminProposal {
        contract_domains::admin::propose_admin_action(env, proposer, action)
    }
    pub fn approve_admin_proposal(env: Env, approver: Address, proposal_id: u64) -> AdminProposal {
        contract_domains::admin::approve_admin_proposal(env, approver, proposal_id)
    }
    pub fn execute_admin_proposal(env: Env, executor: Address, proposal_id: u64) -> AdminProposal {
        contract_domains::admin::execute_admin_proposal(env, executor, proposal_id)
    }
    pub fn get_admin_proposal(env: Env, proposal_id: u64) -> AdminProposal {
        contract_domains::admin::get_admin_proposal(env, proposal_id)
    }
    pub fn get_metrics(env: Env) -> types::GlobalMetrics {
        contract_domains::analytics::get_metrics(env)
    }
    pub fn generate_compliance_report(env: Env, admin: Address, period: ReportPeriod) -> ComplianceReport {
        contract_domains::admin::generate_compliance_report(env, admin, period)
    }
    pub fn get_compliance_report(env: Env, report_id: u64) -> ComplianceReport {
        contract_domains::admin::get_compliance_report(env, report_id)
    }
    pub fn finalize_compliance_report(env: Env, admin: Address, report_id: u64) {
        contract_domains::admin::finalize_compliance_report(env, admin, report_id)
    }
    pub fn set_transfer_threshold(env: Env, admin: Address, threshold: u128) {
        contract_domains::admin::set_transfer_threshold(env, admin, threshold)
    }
    pub fn set_required_approvals(env: Env, admin: Address, count: u32) {
        contract_domains::admin::set_required_approvals(env, admin, count)
    }
    pub fn approve_high_value_transfer(env: Env, waste_id: u128, approver: Address) -> Result<(), Error> {
        contract_domains::admin::approve_high_value_transfer(env, waste_id, approver)
    }
    pub fn substitute_waste( env: Env, original_id: u128, substitute_id: u128, approver: Address, reason: String, ) -> Result<(), Error> {
        contract_domains::waste::substitute_waste(env, original_id, substitute_id, approver, reason)
    }
    pub fn get_transaction_stats(env: Env) -> TransactionStats {
        contract_domains::analytics::get_transaction_stats(env)
    }
    pub fn record_performance_metric(env: Env, admin: Address, gas_used: u64, is_success: bool) {
        contract_domains::analytics::record_performance_metric(env, admin, gas_used, is_success)
    }
    pub fn take_performance_snapshot( env: Env, admin: Address, active_users: u32, waste_per_hour: u128, latency_ms: u32, ) {
        contract_domains::analytics::take_performance_snapshot(env, admin, active_users, waste_per_hour, latency_ms)
    }
    pub fn analyze_performance_period(env: Env, start: u64, end: u64) -> TransactionStats {
        contract_domains::analytics::analyze_performance_period(env, start, end)
    }
    pub fn pause(env: Env, admin: Address) {
        contract_domains::admin::pause(env, admin)
    }
    pub fn unpause(env: Env, admin: Address) {
        contract_domains::admin::unpause(env, admin)
    }
    pub fn is_paused(env: Env) -> bool {
        contract_domains::admin::is_paused(env)
    }
    pub fn distribute_rewards(env: Env, waste_id: u64, incentive_id: u64, manufacturer: Address) -> i128 {
        contract_domains::incentive::distribute_rewards(env, waste_id, incentive_id, manufacturer)
    }
    pub fn split_waste(env: Env, waste_id: u128, owner: Address, weights: Vec<u128>) -> Result<Vec<u128>, Error> {
        contract_domains::waste::split_waste(env, waste_id, owner, weights)
    }
    pub fn merge_wastes(env: Env, waste_ids: Vec<u128>, owner: Address) -> Result<u128, Error> {
        contract_domains::waste::merge_wastes(env, waste_ids, owner)
    }
    pub fn reserve_waste(env: Env, waste_id: u128, reserver: Address, duration: u64) -> Result<types::Waste, Error> {
        contract_domains::waste::reserve_waste(env, waste_id, reserver, duration)
    }
    pub fn cancel_reservation(env: Env, waste_id: u128, caller: Address) -> Result<types::Waste, Error> {
        contract_domains::waste::cancel_reservation(env, waste_id, caller)
    }
    pub fn create_challenge( env: Env, admin: Address, title: soroban_sdk::Symbol, target_weight: u128, waste_type: WasteType, start_time: u64, end_time: u64, reward: u128, ) -> Challenge {
        contract_domains::participant::create_challenge( env, admin, title, target_weight, waste_type, start_time, end_time, reward, )
    }
    pub fn join_challenge(env: Env, challenge_id: u64, participant: Address) {
        contract_domains::participant::join_challenge(env, challenge_id, participant)
    }
    pub fn get_challenge_progress(env: Env, challenge_id: u64, participant: Address) -> ChallengeProgress {
        contract_domains::participant::get_challenge_progress(env, challenge_id, participant)
    }
    pub fn update_challenge_progress(env: Env, challenge_id: u64, participant: Address, weight_grams: u128) {
        contract_domains::participant::update_challenge_progress(env, challenge_id, participant, weight_grams)
    }
    pub fn complete_challenge(env: Env, challenge_id: u64, participant: Address) {
        contract_domains::participant::complete_challenge(env, challenge_id, participant)
    }
    pub fn get_active_challenges(env: Env) -> Vec<Challenge> {
        contract_domains::participant::get_active_challenges(env)
    }
    pub fn get_challenge(env: Env, challenge_id: u64) -> Option<Challenge> {
        contract_domains::participant::get_challenge(env, challenge_id)
    }
    pub fn initiate_transfer( env: Env, waste_id: u128, from: Address, to: Address, latitude: i128, longitude: i128, ) -> PendingTransfer {
        contract_domains::transfer::initiate_transfer(env, waste_id, from, to, latitude, longitude)
    }
    pub fn approve_transfer(env: Env, transfer_id: u64, recipient: Address) -> PendingTransfer {
        contract_domains::transfer::approve_transfer(env, transfer_id, recipient)
    }
    pub fn reject_transfer(env: Env, transfer_id: u64, recipient: Address) -> PendingTransfer {
        contract_domains::transfer::reject_transfer(env, transfer_id, recipient)
    }
    pub fn get_pending_transfer(env: Env, transfer_id: u64) -> Option<PendingTransfer> {
        contract_domains::transfer::get_pending_transfer(env, transfer_id)
    }
    pub fn expire_transfer(env: Env, transfer_id: u64) -> PendingTransfer {
        contract_domains::transfer::expire_transfer(env, transfer_id)
    }
    pub fn get_milestones(env: Env) -> Vec<Milestone> {
        contract_domains::participant::get_milestones(env)
    }
    pub fn get_participant_milestones(env: Env, participant: Address) -> Vec<u32> {
        contract_domains::participant::get_participant_milestones(env, participant)
    }
    pub fn get_top_recyclers(env: Env, limit: u32) -> Vec<LeaderboardEntry> {
        contract_domains::participant::get_top_recyclers(env, limit)
    }
    pub fn get_top_collectors(env: Env, limit: u32) -> Vec<LeaderboardEntry> {
        contract_domains::participant::get_top_collectors(env, limit)
    }
    pub fn get_top_verifiers(env: Env, limit: u32) -> Vec<LeaderboardEntry> {
        contract_domains::participant::get_top_verifiers(env, limit)
    }
    pub fn get_top_earners(env: Env, limit: u32) -> Vec<LeaderboardEntry> {
        contract_domains::participant::get_top_earners(env, limit)
    }
    pub fn get_participant_rank(env: Env, participant: Address, metric: soroban_sdk::Symbol) -> u32 {
        contract_domains::participant::get_participant_rank(env, participant, metric)
    }
    pub fn schedule_incentive( env: Env, incentive_id: u64, rewarder: Address, starts_at: Option<u64>, ends_at: Option<u64>, ) -> Result<Incentive, Error> {
        contract_domains::incentive::schedule_incentive(env, incentive_id, rewarder, starts_at, ends_at)
    }
    pub fn set_processing_cost(env: Env, waste_id: u128, owner: Address, cost: u128) -> Result<types::Waste, Error> {
        contract_domains::analytics::set_processing_cost(env, waste_id, owner, cost)
    }
    pub fn get_total_processing_costs(env: Env) -> u128 {
        contract_domains::analytics::get_total_processing_costs(env)
    }
    pub fn get_participant_processing_costs(env: Env, participant: Address) -> u128 {
        contract_domains::analytics::get_participant_processing_costs(env, participant)
    }
    pub fn set_waste_composition( env: Env, waste_id: u128, verifier: Address, composition: Vec<types::MaterialComposition>, ) -> Result<types::Waste, Error> {
        contract_domains::analytics::set_waste_composition(env, waste_id, verifier, composition)
    }
    pub fn get_wastes_by_composition(env: Env, material_type: WasteType, min_percentage: u32) -> Vec<u128> {
        contract_domains::analytics::get_wastes_by_composition(env, material_type, min_percentage)
    }
    pub fn participant_composition_analysis(env: Env, participant: Address) -> Vec<types::CompositionEntry> {
        contract_domains::analytics::participant_composition_analysis(env, participant)
    }
    pub fn get_composition_analytics(env: Env) -> Vec<types::CompositionEntry> {
        contract_domains::analytics::get_composition_analytics(env)
    }
    pub fn verify_waste_composition(env: Env, waste_id: u128) -> Result<bool, Error> {
        contract_domains::verification::verify_waste_composition(env, waste_id)
    }
    pub fn set_recycling_goal( env: Env, participant: Address, target_weight: u128, target_date: u64, waste_type: OptionalWasteType, ) -> Result<(), Error> {
        contract_domains::participant::set_recycling_goal(env, participant, target_weight, target_date, waste_type)
    }
    pub fn get_goal_progress(env: Env, participant: Address) -> Vec<types::RecyclingGoal> {
        contract_domains::participant::get_goal_progress(env, participant)
    }
    pub fn get_participants_meeting_goals(env: Env) -> Vec<Address> {
        contract_domains::participant::get_participants_meeting_goals(env)
    }
    pub fn get_global_recycling_rate(env: Env) -> u32 {
        contract_domains::analytics::get_global_recycling_rate(env)
    }
    pub fn get_participant_recycling_rate(env: Env, participant: Address) -> u32 {
        contract_domains::analytics::get_participant_recycling_rate(env, participant)
    }
    pub fn create_dispute(env: Env, disputer: Address, waste_id: u128, reason: String) -> Dispute {
        contract_domains::verification::create_dispute(env, disputer, waste_id, reason)
    }
    pub fn resolve_dispute(env: Env, admin: Address, dispute_id: u64, accepted: bool, note: String) -> Dispute {
        contract_domains::verification::resolve_dispute(env, admin, dispute_id, accepted, note)
    }
    pub fn get_dispute(env: Env, dispute_id: u64) -> Option<Dispute> {
        contract_domains::verification::get_dispute(env, dispute_id)
    }
    pub fn get_disputes(env: Env, status: DisputeStatus) -> Vec<Dispute> {
        contract_domains::verification::get_disputes(env, status)
    }
    pub fn get_reputation_badge(env: Env, address: Address) -> ReputationBadge {
        contract_domains::participant::get_reputation_badge(env, address)
    }
    pub fn penalize_reputation(env: Env, admin: Address, target: Address, delta: i128) {
        contract_domains::participant::penalize_reputation(env, admin, target, delta)
    }
    pub fn decay_reputation(env: Env, address: Address) -> i128 {
        contract_domains::participant::decay_reputation(env, address)
    }
    pub fn get_participants_by_reputation(env: Env, min_score: i128) -> Vec<Address> {
        contract_domains::participant::get_participants_by_reputation(env, min_score)
    }
    pub fn create_collection_route(env: Env, collector: Address, waste_ids: Vec<u128>) -> CollectionRoute {
        contract_domains::participant::create_collection_route(env, collector, waste_ids)
    }
    pub fn complete_route(env: Env, collector: Address, route_id: u64) -> CollectionRoute {
        contract_domains::participant::complete_route(env, collector, route_id)
    }
    pub fn get_route(env: Env, route_id: u64) -> Option<CollectionRoute> {
        contract_domains::participant::get_route(env, route_id)
    }
    pub fn get_wastes_in_radius(env: Env, lat: i128, lon: i128, radius_km: u32) -> Vec<u128> {
        contract_domains::participant::get_wastes_in_radius(env, lat, lon, radius_km)
    }
    pub fn calculate_quality_score(env: Env, waste_id: u128, scorer: Address) -> Result<QualityScore, Error> {
        contract_domains::verification::calculate_quality_score(env, waste_id, scorer)
    }
    pub fn get_quality_score(env: Env, waste_id: u128) -> Option<QualityScore> {
        contract_domains::verification::get_quality_score(env, waste_id)
    }
    pub fn get_wastes_by_quality(env: Env, min_score: u32) -> Vec<u128> {
        contract_domains::verification::get_wastes_by_quality(env, min_score)
    }
    pub fn update_waste_location( env: Env, waste_id: u128, latitude: i128, longitude: i128, updater: Address, ) -> Result<(), Error> {
        contract_domains::waste::update_waste_location(env, waste_id, latitude, longitude, updater)
    }
    pub fn get_location_history(env: Env, waste_id: u128) -> Vec<LocationRecord> {
        contract_domains::waste::get_location_history(env, waste_id)
    }
    pub fn create_waste_batch(env: Env, creator: Address) -> Result<u64, Error> {
        contract_domains::waste::create_waste_batch(env, creator)
    }
    pub fn add_waste_to_batch(env: Env, batch_id: u64, waste_id: u128, adder: Address) -> Result<(), Error> {
        contract_domains::waste::add_waste_to_batch(env, batch_id, waste_id, adder)
    }
    pub fn get_batch(env: Env, batch_id: u64) -> Option<WasteBatch> {
        contract_domains::waste::get_batch(env, batch_id)
    }
    pub fn mark_batch_ready(env: Env, batch_id: u64, marker: Address) -> Result<(), Error> {
        contract_domains::waste::mark_batch_ready(env, batch_id, marker)
    }
    pub fn process_batch(env: Env, batch_id: u64, processor: Address, note: String) -> Result<(), Error> {
        contract_domains::waste::process_batch(env, batch_id, processor, note)
    }
    pub fn certify_waste( env: Env, waste_id: u128, level: u32, certifier: Address, expires_at: u64, notes: String, ) -> Result<(), Error> {
        contract_domains::verification::certify_waste(env, waste_id, level, certifier, expires_at, notes)
    }
    pub fn get_waste_certification(env: Env, waste_id: u128) -> Option<WasteCertification> {
        contract_domains::verification::get_waste_certification(env, waste_id)
    }
    pub fn is_waste_certified(env: Env, waste_id: u128) -> bool {
        contract_domains::verification::is_waste_certified(env, waste_id)
    }
    pub fn grant_permission(env: Env, admin: Address, subject: Address, permission: u32) -> Result<(), Error> {
        contract_domains::admin::grant_permission(env, admin, subject, permission)
    }
    pub fn revoke_permission(env: Env, admin: Address, subject: Address, permission: u32) -> Result<(), Error> {
        contract_domains::admin::revoke_permission(env, admin, subject, permission)
    }
    pub fn has_permission(env: Env, subject: Address, permission: u32) -> Result<bool, Error> {
        contract_domains::admin::has_permission(env, subject, permission)
    }
    pub fn get_permission_audit(env: Env, subject: Address) -> Vec<PermissionAuditEntry> {
        contract_domains::admin::get_permission_audit(env, subject)
    }
    pub fn reconcile_waste( env: Env, waste_id: u128, verified_weight: u128, reconciler: Address, reason: String, ) -> Result<ReconciliationRecord, Error> {
        contract_domains::verification::reconcile_waste(env, waste_id, verified_weight, reconciler, reason)
    }
    pub fn get_reconciliation_log(env: Env, waste_id: u128) -> Vec<ReconciliationRecord> {
        contract_domains::verification::get_reconciliation_log(env, waste_id)
    }
}
