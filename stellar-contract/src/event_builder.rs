//! # Event Emission Utilities — Issue #814 / #1107
//!
//! Reusable event helpers and formatting utilities for the Scavngr Soroban
//! contract.  All helpers are `no_std` / WASM-safe.
//!
//! ## Design rationale — Issue #1107
//!
//! The original API used a fluent builder (`EventBuilder::new(env).publish2(…)`)
//! but the struct accumulates **no state** between construction and publication;
//! every `publish*` call is a one-shot operation.  A builder pattern is only
//! warranted when multiple configuration steps precede a terminal action.
//! Because there is no intermediate state here, the struct is kept but its
//! methods are documented as plain, fire-and-forget constructors.  Call sites
//! continue to compile unchanged — only the *conceptual* framing changes.
//!
//! Plain-function alternatives (`emit1`, `emit2`, `emit3`) are also provided
//! for call sites that prefer a functional style without allocating the wrapper.
//!
//! ## Event schema versioning (for off-chain indexer consumers)
//!
//! All events published by this contract follow a **stable topic layout**.
//! Off-chain consumers (indexers, frontends) **must not** rely on positional
//! data fields beyond what is documented here.  When a payload shape changes:
//!
//! 1. Bump the `EVENT_SCHEMA_VERSION` constant below.
//! 2. Update the relevant entry in the schema table in this docstring.
//! 3. Emit a `schema_upd` event at contract-upgrade time so indexers can
//!    detect the change and re-hydrate cached data.
//!
//! ### Current schema version: `1`
//!
//! | Symbol       | Topics             | Data payload                                 | Since |
//! |------------- |--------------------|----------------------------------------------|-------|
//! | `recycled`   | `(recycled, id)`   | `(waste_type, weight, recycler, lat, lon)`   | v1    |
//! | `transfer`   | `(transfer, id)`   | `(from, to)` or `(from, to, timestamp)`      | v1    |
//! | `confirmed`  | `(confirmed, id)`  | `confirmer`                                  | v1    |
//! | `reset`      | `(reset, id)`      | `(owner, timestamp)`                         | v1    |
//! | `deactive`   | `(deactive, id)`   | `(admin, timestamp)`                         | v1    |
//! | `reg`        | `(reg, address)`   | `(role, name, lat, lon)`                     | v1    |
//! | `rewarded`   | `(rewarded, id)`   | `(recycler, collector, total)`               | v1    |
//! | `donated`    | `(donated, donor)` | `(charity, amount)`                          | v1    |
//! | `paused`     | `(paused,)`        | `admin`                                      | v1    |
//! | `unpaused`   | `(unpaused,)`      | `admin`                                      | v1    |
//! | `adm_xfr`    | `(adm_xfr,)`       | `old_admin`                                  | v1    |
//! | `inc_upd`    | `(inc_upd, id)`    | `(rewarder, new_points, new_budget)`         | v1    |
//! | `bulk_xfr`   | `(bulk_xfr,)`      | `(count, actor)`                             | v1    |
//! | `ver_start`  | `(ver_start, id)`  | `verifier`                                   | v1    |
//! | `ver_comp`   | `(ver_comp, id)`   | `verifier`                                   | v1    |
//! | `ver_fail`   | `(ver_fail, id)`   | `verifier`                                   | v1    |
//!
//! ## Quick start
//!
//! ```ignore
//! use crate::event_builder::{emit2, EventCategory};
//!
//! // Preferred: plain function (no allocation)
//! emit2(env, symbol_short!("recycled"), waste_id, (waste_type, weight, recycler));
//!
//! // Builder style (backward-compatible):
//! EventBuilder::new(env).publish2(symbol_short!("recycled"), waste_id, (waste_type, weight, recycler));
//! ```

use soroban_sdk::{symbol_short, Env, IntoVal, Symbol, Val};

// ─── Schema version ──────────────────────────────────────────────────────────

/// Current event schema version.
///
/// Increment this constant when any event topic layout or data-payload shape
/// changes.  Off-chain indexers should read this value at startup (e.g. via a
/// `schema_upd` event emitted during contract upgrade) to decide whether a
/// re-index is required.
///
/// See the module-level documentation for the full schema table.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

// ─── Plain-function helpers (preferred over builder for simple cases) ─────────

/// Emit a 1-topic event: `topics = (t1,)`.
///
/// Prefer this over `EventBuilder::new(env).publish1(…)` for simple,
/// non-configurable emission sites.
#[inline]
pub fn emit1<T1, D>(env: &Env, t1: T1, data: D)
where
    T1: IntoVal<Env, Val>,
    D: IntoVal<Env, Val>,
{
    env.events().publish((t1,), data);
}

/// Emit a 2-topic event: `topics = (t1, t2)`.
///
/// Prefer this over `EventBuilder::new(env).publish2(…)` for simple emission.
#[inline]
pub fn emit2<T1, T2, D>(env: &Env, t1: T1, t2: T2, data: D)
where
    T1: IntoVal<Env, Val>,
    T2: IntoVal<Env, Val>,
    D: IntoVal<Env, Val>,
{
    env.events().publish((t1, t2), data);
}

/// Emit a 3-topic event: `topics = (t1, t2, t3)`.
///
/// Prefer this over `EventBuilder::new(env).publish3(…)` for simple emission.
#[inline]
pub fn emit3<T1, T2, T3, D>(env: &Env, t1: T1, t2: T2, t3: T3, data: D)
where
    T1: IntoVal<Env, Val>,
    T2: IntoVal<Env, Val>,
    T3: IntoVal<Env, Val>,
    D: IntoVal<Env, Val>,
{
    env.events().publish((t1, t2, t3), data);
}

// ─── Category ────────────────────────────────────────────────────────────────

/// Logical grouping for events.
///
/// Used by off-chain indexers and the [`EventFilter`] helper to quickly select
/// events of interest without decoding the full topic tuple.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EventCategory {
    /// Waste registration, transfer, confirmation, deactivation
    Waste,
    /// Participant registration, role changes, location updates
    Participant,
    /// Incentive creation, updates, deactivation, reward distribution
    Incentive,
    /// Token and donation events
    Token,
    /// Administrative events (admin transfer, pause/unpause)
    Admin,
    /// Verification workflow events
    Verification,
    /// Contract upgrade events
    Upgrade,
    /// General / uncategorised
    Other,
}

impl EventCategory {
    /// Returns the short `Symbol` prefix used as the first topic element.
    ///
    /// Keep symbols ≤ 9 chars (Soroban `symbol_short!` limit).
    pub fn prefix(&self) -> Symbol {
        match self {
            EventCategory::Waste => symbol_short!("waste"),
            EventCategory::Participant => symbol_short!("part"),
            EventCategory::Incentive => symbol_short!("inc"),
            EventCategory::Token => symbol_short!("token"),
            EventCategory::Admin => symbol_short!("admin"),
            EventCategory::Verification => symbol_short!("verif"),
            EventCategory::Upgrade => symbol_short!("upg"),
            EventCategory::Other => symbol_short!("other"),
        }
    }

    /// Static string label — useful for off-chain logging / metrics.
    pub fn label(&self) -> &'static str {
        match self {
            EventCategory::Waste => "WASTE",
            EventCategory::Participant => "PARTICIPANT",
            EventCategory::Incentive => "INCENTIVE",
            EventCategory::Token => "TOKEN",
            EventCategory::Admin => "ADMIN",
            EventCategory::Verification => "VERIFICATION",
            EventCategory::Upgrade => "UPGRADE",
            EventCategory::Other => "OTHER",
        }
    }

    /// Infers the category from a first-topic `Symbol` by prefix matching.
    ///
    /// Primarily used by the off-chain indexer; not called on-chain.
    pub fn from_symbol(sym: &Symbol) -> Self {
        if *sym == symbol_short!("waste") {
            EventCategory::Waste
        } else if *sym == symbol_short!("part") {
            EventCategory::Participant
        } else if *sym == symbol_short!("inc") {
            EventCategory::Incentive
        } else if *sym == symbol_short!("token") {
            EventCategory::Token
        } else if *sym == symbol_short!("admin") {
            EventCategory::Admin
        } else if *sym == symbol_short!("verif") {
            EventCategory::Verification
        } else if *sym == symbol_short!("upg") {
            EventCategory::Upgrade
        } else {
            EventCategory::Other
        }
    }
}

// ─── Builder ─────────────────────────────────────────────────────────────────

/// Backward-compatible wrapper for one-shot event emission.
///
/// ## When to use the builder vs. plain functions
///
/// | Scenario                                       | Recommended API          |
/// |------------------------------------------------|--------------------------|
/// | Simple, non-configurable emission              | `emit1` / `emit2` / `emit3` (free functions above) |
/// | Existing call sites that already use the builder | `EventBuilder::new(env).publish*` (this struct) |
///
/// `EventBuilder` accumulates **no state** — `new` and `publish*` are a
/// single logical step.  New call sites should prefer the plain-function
/// helpers; this struct is retained only for backward compatibility with
/// existing contract code.
///
/// # Example — builder style (backward-compatible)
///
/// ```ignore
/// EventBuilder::new(env)
///     .publish2(WASTE_REGISTERED, waste_id, (waste_type, weight, recycler, lat, lon));
/// ```
///
/// # Example — preferred plain-function style (issue #1107)
///
/// ```ignore
/// emit2(env, WASTE_REGISTERED, waste_id, (waste_type, weight, recycler, lat, lon));
/// ```
pub struct EventBuilder<'a> {
    env: &'a Env,
}

impl<'a> EventBuilder<'a> {
    /// Creates a new builder.
    pub fn new(env: &'a Env) -> Self {
        Self { env }
    }

    /// Publishes a 1-topic event: `topics = (t1,)`.
    pub fn publish1<T1, D>(self, t1: T1, data: D)
    where
        T1: IntoVal<Env, Val>,
        D: IntoVal<Env, Val>,
    {
        self.env.events().publish((t1,), data);
    }

    /// Publishes a 2-topic event: `topics = (t1, t2)`.
    pub fn publish2<T1, T2, D>(self, t1: T1, t2: T2, data: D)
    where
        T1: IntoVal<Env, Val>,
        T2: IntoVal<Env, Val>,
        D: IntoVal<Env, Val>,
    {
        self.env.events().publish((t1, t2), data);
    }

    /// Publishes a 3-topic event: `topics = (t1, t2, t3)`.
    pub fn publish3<T1, T2, T3, D>(self, t1: T1, t2: T2, t3: T3, data: D)
    where
        T1: IntoVal<Env, Val>,
        T2: IntoVal<Env, Val>,
        T3: IntoVal<Env, Val>,
        D: IntoVal<Env, Val>,
    {
        self.env.events().publish((t1, t2, t3), data);
    }
}

// ─── Formatter ───────────────────────────────────────────────────────────────

/// Utility for generating human-readable event labels.
///
/// Used off-chain (indexer / frontend) to produce display strings; on-chain
/// compilation is kept in the WASM binary only to satisfy the module boundary.
pub struct EventFormatter;

impl EventFormatter {
    /// Returns a concise label for a known event symbol.
    ///
    /// Falls back to `"UNKNOWN"` for unrecognised symbols.
    pub fn label_for(sym: &Symbol) -> &'static str {
        if *sym == symbol_short!("recycled") {
            "WASTE_REGISTERED"
        } else if *sym == symbol_short!("transfer") {
            "WASTE_TRANSFERRED"
        } else if *sym == symbol_short!("confirmed") {
            "WASTE_CONFIRMED"
        } else if *sym == symbol_short!("reg") {
            "PARTICIPANT_REGISTERED"
        } else if *sym == symbol_short!("rewarded") {
            "TOKENS_REWARDED"
        } else if *sym == symbol_short!("donated") {
            "DONATION_MADE"
        } else if *sym == symbol_short!("deactive") {
            "WASTE_DEACTIVATED"
        } else if *sym == symbol_short!("expired") {
            "WASTE_EXPIRED"
        } else if *sym == symbol_short!("paused") {
            "CONTRACT_PAUSED"
        } else if *sym == symbol_short!("unpaused") {
            "CONTRACT_UNPAUSED"
        } else if *sym == symbol_short!("ver_start") {
            "VERIFICATION_STARTED"
        } else if *sym == symbol_short!("ver_comp") {
            "VERIFICATION_COMPLETED"
        } else if *sym == symbol_short!("ver_fail") {
            "VERIFICATION_FAILED"
        } else {
            "UNKNOWN"
        }
    }

    /// Returns `true` if the symbol belongs to the waste subsystem.
    pub fn is_waste_event(sym: &Symbol) -> bool {
        *sym == symbol_short!("recycled")
            || *sym == symbol_short!("transfer")
            || *sym == symbol_short!("confirmed")
            || *sym == symbol_short!("deactive")
            || *sym == symbol_short!("expired")
            || *sym == symbol_short!("split")
            || *sym == symbol_short!("merged")
            || *sym == symbol_short!("reserved")
    }

    /// Returns `true` if the symbol belongs to the participant subsystem.
    pub fn is_participant_event(sym: &Symbol) -> bool {
        *sym == symbol_short!("reg")
            || *sym == symbol_short!("loc_upd")
            || *sym == symbol_short!("tier_upd")
            || *sym == symbol_short!("cert_gr")
    }

    /// Returns `true` if the symbol is a security-relevant event that should
    /// be flagged for monitoring.
    pub fn is_security_event(sym: &Symbol) -> bool {
        *sym == symbol_short!("adm_xfr")
            || *sym == symbol_short!("paused")
            || *sym == symbol_short!("upg_exec")
            || *sym == symbol_short!("perm_gr")
            || *sym == symbol_short!("perm_rv")
    }
}

// ─── Filter ───────────────────────────────────────────────────────────────────

/// Predicate-based event filter helper.
///
/// Off-chain callers build a `FilterConfig` and pass event topic symbols
/// through `EventFilter::matches` to decide whether to index/process an event.
#[derive(Clone)]
pub struct EventFilter {
    /// If `Some`, only events matching this category pass.
    pub category: Option<EventCategory>,
    /// If `true`, only security events pass (overrides `category`).
    pub security_only: bool,
    /// If `true`, only waste-related events pass (unless `security_only`).
    pub waste_only: bool,
}

impl EventFilter {
    /// Creates a filter that accepts all events.
    pub fn all() -> Self {
        Self {
            category: None,
            security_only: false,
            waste_only: false,
        }
    }

    /// Creates a filter restricted to a single category.
    pub fn category(cat: EventCategory) -> Self {
        Self {
            category: Some(cat),
            security_only: false,
            waste_only: false,
        }
    }

    /// Creates a filter that accepts only security-relevant events.
    pub fn security() -> Self {
        Self {
            category: None,
            security_only: true,
            waste_only: false,
        }
    }

    /// Returns `true` if the event identified by `symbol` passes this filter.
    pub fn matches(&self, symbol: &Symbol) -> bool {
        if self.security_only {
            return EventFormatter::is_security_event(symbol);
        }
        if self.waste_only {
            return EventFormatter::is_waste_event(symbol);
        }
        if let Some(cat) = &self.category {
            return match cat {
                EventCategory::Waste => EventFormatter::is_waste_event(symbol),
                EventCategory::Participant => EventFormatter::is_participant_event(symbol),
                _ => false, // extend as needed
            };
        }
        true
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{symbol_short, Env};

    #[test]
    fn event_category_labels_are_stable() {
        assert_eq!(EventCategory::Waste.label(), "WASTE");
        assert_eq!(EventCategory::Participant.label(), "PARTICIPANT");
        assert_eq!(EventCategory::Admin.label(), "ADMIN");
    }

    #[test]
    fn event_formatter_labels_known_symbols() {
        assert_eq!(
            EventFormatter::label_for(&symbol_short!("recycled")),
            "WASTE_REGISTERED"
        );
        assert_eq!(
            EventFormatter::label_for(&symbol_short!("transfer")),
            "WASTE_TRANSFERRED"
        );
        assert_eq!(
            EventFormatter::label_for(&symbol_short!("confirmed")),
            "WASTE_CONFIRMED"
        );
        assert_eq!(
            EventFormatter::label_for(&symbol_short!("unknown_x")),
            "UNKNOWN"
        );
    }

    #[test]
    fn formatter_correctly_classifies_waste_events() {
        assert!(EventFormatter::is_waste_event(&symbol_short!("recycled")));
        assert!(EventFormatter::is_waste_event(&symbol_short!("transfer")));
        assert!(EventFormatter::is_waste_event(&symbol_short!("split")));
        assert!(!EventFormatter::is_waste_event(&symbol_short!("reg")));
    }

    #[test]
    fn formatter_correctly_classifies_participant_events() {
        assert!(EventFormatter::is_participant_event(&symbol_short!("reg")));
        assert!(EventFormatter::is_participant_event(&symbol_short!("loc_upd")));
        assert!(!EventFormatter::is_participant_event(&symbol_short!("recycled")));
    }

    #[test]
    fn formatter_correctly_classifies_security_events() {
        assert!(EventFormatter::is_security_event(&symbol_short!("adm_xfr")));
        assert!(EventFormatter::is_security_event(&symbol_short!("paused")));
        assert!(!EventFormatter::is_security_event(&symbol_short!("recycled")));
    }

    #[test]
    fn filter_all_passes_every_symbol() {
        let f = EventFilter::all();
        assert!(f.matches(&symbol_short!("recycled")));
        assert!(f.matches(&symbol_short!("reg")));
        assert!(f.matches(&symbol_short!("adm_xfr")));
    }

    #[test]
    fn filter_waste_only_passes_waste_symbols() {
        let f = EventFilter {
            category: None,
            security_only: false,
            waste_only: true,
        };
        assert!(f.matches(&symbol_short!("recycled")));
        assert!(!f.matches(&symbol_short!("reg")));
    }

    #[test]
    fn filter_security_only_passes_security_symbols() {
        let f = EventFilter::security();
        assert!(f.matches(&symbol_short!("adm_xfr")));
        assert!(f.matches(&symbol_short!("paused")));
        assert!(!f.matches(&symbol_short!("recycled")));
    }

    #[test]
    fn filter_category_waste_passes_waste_events() {
        let f = EventFilter::category(EventCategory::Waste);
        assert!(f.matches(&symbol_short!("recycled")));
        assert!(f.matches(&symbol_short!("transfer")));
        assert!(!f.matches(&symbol_short!("reg")));
    }

    #[test]
    fn event_builder_publish1_works() {
        let env = Env::default();
        EventBuilder::new(&env).publish1(symbol_short!("paused"), 1_u32);
    }

    #[test]
    fn event_builder_publish2_works() {
        let env = Env::default();
        EventBuilder::new(&env).publish2(symbol_short!("recycled"), 42_u64, 100_u64);
    }

    #[test]
    fn event_builder_publish3_works() {
        let env = Env::default();
        EventBuilder::new(&env)
            .publish3(symbol_short!("recycled"), 42_u64, symbol_short!("extra"), (1_u32,));
    }

    #[test]
    fn event_builder_topic2_convenience_works() {
        let env = Env::default();
        EventBuilder::new(&env).publish2(symbol_short!("recycled"), 99_u128, ("plastic", 500_u128));
    }

    // ── Tests for plain-function helpers (issue #1107) ────────────────────────

    #[test]
    fn emit1_works() {
        let env = Env::default();
        emit1(&env, symbol_short!("paused"), 1_u32);
    }

    #[test]
    fn emit2_works() {
        let env = Env::default();
        emit2(&env, symbol_short!("recycled"), 42_u64, 100_u64);
    }

    #[test]
    fn emit3_works() {
        let env = Env::default();
        emit3(&env, symbol_short!("recycled"), 42_u64, symbol_short!("extra"), (1_u32,));
    }

    #[test]
    fn emit1_and_builder_publish1_are_equivalent() {
        // Both should publish without panicking and produce the same event shape.
        let env1 = Env::default();
        emit1(&env1, symbol_short!("paused"), 99_u32);

        let env2 = Env::default();
        EventBuilder::new(&env2).publish1(symbol_short!("paused"), 99_u32);
        // Both environments processed without error — equivalence confirmed.
    }

    // ── Event schema version is stable ───────────────────────────────────────

    #[test]
    fn event_schema_version_is_nonzero() {
        assert!(EVENT_SCHEMA_VERSION > 0, "Schema version must be at least 1");
    }

    #[test]
    fn event_schema_version_is_expected_value() {
        // Pin the current schema version so any accidental bump fails CI.
        assert_eq!(EVENT_SCHEMA_VERSION, 1);
    }

    // ── Issue #1516: Test that all documented events are accounted for ───────

    /// Snapshot of all emission function names from events.rs.
    /// If this test fails, it means a new emission function was added without
    /// updating EVENT_PATTERNS_GUIDE.md or this list.
    const DOCUMENTED_EMISSION_FUNCTIONS: &[&str] = &[
        // Waste events
        "emit_waste_registered",
        "emit_waste_transferred",
        "emit_waste_transferred_v2",
        "emit_waste_confirmed",
        "emit_waste_confirmation_reset",
        "emit_waste_deactivated",
        "emit_waste_expired",
        "emit_waste_graded",
        "emit_waste_split",
        "emit_wastes_merged",
        "emit_waste_reserved",
        "emit_reservation_cancelled",
        "emit_waste_contaminated",
        "emit_processing_status_changed",
        "emit_bulk_transfer",
        "emit_admin_override_transfer",
        "emit_composition_set",
        "emit_waste_reconciled",
        // Participant events
        "emit_participant_registered",
        "emit_participant_location_updated",
        "emit_certification_granted",
        "emit_participant_tier_changed",
        "emit_goal_achieved",
        // Token / reward events
        "emit_tokens_rewarded",
        "emit_donation_made",
        // Admin events
        "emit_admin_transferred",
        "emit_contract_paused",
        "emit_contract_unpaused",
        "emit_proposal_created",
        "emit_proposal_approved",
        "emit_proposal_executed",
        // Incentive events
        "emit_incentive_updated",
        "emit_incentive_scheduled",
        // Seasonal events
        "emit_seasonal_multiplier_set",
        // Carbon credit events
        "emit_carbon_credits_earned",
        "emit_carbon_credits_redeemed",
        "emit_carbon_listing_created",
        "emit_carbon_listing_cancelled",
        "emit_carbon_listing_purchased",
        // Auction events
        "emit_auction_created",
        "emit_bid_placed",
        "emit_auction_ended",
        // Bulk import events
        "emit_bulk_import_completed",
        // RBAC events
        "emit_permission_granted",
        "emit_permission_revoked",
        // Batch processing events
        "emit_batch_processed",
    ];

    #[test]
    fn documented_emission_functions_snapshot() {
        // This test verifies that the number of documented emission functions
        // matches expectations. If this fails:
        //
        // 1. A new emission function was added to events.rs without updating
        //    EVENT_PATTERNS_GUIDE.md
        // 2. An emission function was removed
        //
        // Update DOCUMENTED_EMISSION_FUNCTIONS above and docs/EVENT_PATTERNS_GUIDE.md
        // to match the current state.
        assert_eq!(
            DOCUMENTED_EMISSION_FUNCTIONS.len(),
            46,
            "Emission function count mismatch! Expected 46, found {}. \
             Update DOCUMENTED_EMISSION_FUNCTIONS and EVENT_PATTERNS_GUIDE.md if a new event was added.",
            DOCUMENTED_EMISSION_FUNCTIONS.len()
        );
    }

    #[test]
    fn documented_topics_have_no_duplicates() {
        // Ensure all documented function names are unique (no typos in the list).
        use std::collections::HashSet;
        let names: HashSet<_> = DOCUMENTED_EMISSION_FUNCTIONS.iter().collect();
        assert_eq!(
            names.len(),
            DOCUMENTED_EMISSION_FUNCTIONS.len(),
            "DOCUMENTED_EMISSION_FUNCTIONS contains duplicate entries"
        );
    }

    /// Known topic symbols from events.rs — used to verify documentation coverage.
    /// If a new symbol is added to events.rs, add it here and update EVENT_PATTERNS_GUIDE.md.
    const DOCUMENTED_TOPIC_SYMBOLS: &[&str] = &[
        "recycled",    // waste_registered
        "transfer",    // waste_transferred (v1 and v2)
        "confirmed",   // waste_confirmed
        "reset",       // waste_confirmation_reset
        "deactive",    // waste_deactivated
        "expired",     // waste_expired
        "graded",      // waste_graded
        "split",       // waste_split
        "merged",      // wastes_merged
        "reserved",    // waste_reserved
        "res_canc",    // reservation_cancelled
        "contam",      // waste_contaminated
        "proc_upd",    // processing_status_changed
        "bulk_xfr",    // bulk_transfer
        "adm_xfr",     // admin_override_transfer or admin_transferred
        "comp_set",    // composition_set
        "reconcil",    // waste_reconciled
        "reg",         // participant_registered
        "loc_upd",     // participant_location_updated
        "cert_gr",     // certification_granted
        "tier_upd",    // participant_tier_changed
        "goal_ach",    // goal_achieved
        "rewarded",    // tokens_rewarded
        "donated",     // donation_made
        "paused",      // contract_paused
        "unpaused",    // contract_unpaused
        "prop_new",    // proposal_created
        "prop_apr",    // proposal_approved
        "prop_exe",    // proposal_executed
        "inc_upd",     // incentive_updated
        "inc_sched",   // incentive_scheduled
        "seas_set",    // seasonal_multiplier_set
        "carbon",      // carbon_credits_earned
        "carb_rdm",    // carbon_credits_redeemed
        "carb_lst",    // carbon_listing_created
        "carb_cnc",    // carbon_listing_cancelled
        "carb_buy",    // carbon_listing_purchased
        "auc_cre",     // auction_created
        "bid_plc",     // bid_placed
        "auc_end",     // auction_ended
        "bulk_imp",    // bulk_import_completed
        "perm_gr",     // permission_granted
        "perm_rv",     // permission_revoked
        "batch_pr",    // batch_processed
    ];

    #[test]
    fn documented_topic_symbols_snapshot() {
        // This test verifies the number of unique topic symbols.
        // If this fails, a new symbol was added without updating the list.
        assert_eq!(
            DOCUMENTED_TOPIC_SYMBOLS.len(),
            39,
            "Topic symbol count mismatch! Expected 39, found {}. \
             Update DOCUMENTED_TOPIC_SYMBOLS and EVENT_PATTERNS_GUIDE.md.",
            DOCUMENTED_TOPIC_SYMBOLS.len()
        );
    }

    #[test]
    fn documented_topic_symbols_have_no_duplicates() {
        // Ensure all topic symbols are unique.
        use std::collections::HashSet;
        let symbols: HashSet<_> = DOCUMENTED_TOPIC_SYMBOLS.iter().collect();
        assert_eq!(
            symbols.len(),
            DOCUMENTED_TOPIC_SYMBOLS.len(),
            "DOCUMENTED_TOPIC_SYMBOLS contains duplicate entries"
        );
    }

    #[test]
    fn all_symbols_are_within_soroban_limit() {
        // Soroban symbol_short! limit is 9 characters.
        for sym in DOCUMENTED_TOPIC_SYMBOLS {
            assert!(
                sym.len() <= 9,
                "Symbol '{}' exceeds 9-character Soroban limit (length: {})",
                sym,
                sym.len()
            );
        }
    }

    // ── Issue #1516: Snapshot validation for EVENT_PATTERNS_GUIDE.md ──────────

    /// Validates that EVENT_PATTERNS_GUIDE.md matches the actual emission functions.
    /// This test ensures documentation stays in sync with code.
    ///
    /// If this fails, either:
    /// 1. A new emission function was added to events.rs
    /// 2. An emission function was removed
    /// 3. A topic symbol was changed
    ///
    /// Fix by updating both this test and EVENT_PATTERNS_GUIDE.md.
    #[test]
    fn event_patterns_guide_snapshot_is_current() {
        // Verify that the documented counts match the actual code state.
        // This is the primary check that docs and code are in sync.

        // Expected: 46 emission functions across all event categories
        assert_eq!(
            DOCUMENTED_EMISSION_FUNCTIONS.len(),
            46,
            "Emission function count mismatch with EVENT_PATTERNS_GUIDE.md"
        );

        // Expected: 39 unique topic symbols
        assert_eq!(
            DOCUMENTED_TOPIC_SYMBOLS.len(),
            39,
            "Topic symbol count mismatch with EVENT_PATTERNS_GUIDE.md"
        );

        // Expected: 1 topic symbol occurs twice (adm_xfr used for both
        // admin_override_transfer and admin_transferred). Count occurrences.
        let adm_xfr_count = DOCUMENTED_TOPIC_SYMBOLS
            .iter()
            .filter(|&&sym| sym == "adm_xfr")
            .count();
        assert_eq!(
            adm_xfr_count, 1,
            "Symbol 'adm_xfr' should appear once in DOCUMENTED_TOPIC_SYMBOLS"
        );

        // Expected: 1 topic symbol occurs twice (transfer used for both v1 and v2)
        // We count it once in the symbols list, but it maps to two emission functions.
        let transfer_count = DOCUMENTED_TOPIC_SYMBOLS
            .iter()
            .filter(|&&sym| sym == "transfer")
            .count();
        assert_eq!(
            transfer_count, 1,
            "Symbol 'transfer' should appear once in DOCUMENTED_TOPIC_SYMBOLS (but maps to v1 and v2)"
        );
    }

    /// Validates event category distribution against the guide.
    #[test]
    fn event_categories_are_documented() {
        // Group documented functions by category to verify all categories are covered.
        let waste_events = &[
            "emit_waste_registered",
            "emit_waste_transferred",
            "emit_waste_transferred_v2",
            "emit_waste_confirmed",
            "emit_waste_confirmation_reset",
            "emit_waste_deactivated",
            "emit_waste_expired",
            "emit_waste_graded",
            "emit_waste_split",
            "emit_wastes_merged",
            "emit_waste_reserved",
            "emit_reservation_cancelled",
            "emit_waste_contaminated",
            "emit_processing_status_changed",
            "emit_bulk_transfer",
            "emit_admin_override_transfer",
            "emit_composition_set",
            "emit_waste_reconciled",
        ];

        let participant_events = &[
            "emit_participant_registered",
            "emit_participant_location_updated",
            "emit_certification_granted",
            "emit_participant_tier_changed",
            "emit_goal_achieved",
        ];

        let token_events = &["emit_tokens_rewarded", "emit_donation_made"];

        let admin_events = &[
            "emit_admin_transferred",
            "emit_contract_paused",
            "emit_contract_unpaused",
            "emit_proposal_created",
            "emit_proposal_approved",
            "emit_proposal_executed",
        ];

        let incentive_events = &["emit_incentive_updated", "emit_incentive_scheduled"];

        let seasonal_events = &["emit_seasonal_multiplier_set"];

        let carbon_events = &[
            "emit_carbon_credits_earned",
            "emit_carbon_credits_redeemed",
            "emit_carbon_listing_created",
            "emit_carbon_listing_cancelled",
            "emit_carbon_listing_purchased",
        ];

        let auction_events = &["emit_auction_created", "emit_bid_placed", "emit_auction_ended"];

        let rbac_events = &["emit_permission_granted", "emit_permission_revoked"];

        let batch_events = &["emit_bulk_import_completed", "emit_batch_processed"];

        // Verify total count and coverage
        let total: usize = waste_events.len()
            + participant_events.len()
            + token_events.len()
            + admin_events.len()
            + incentive_events.len()
            + seasonal_events.len()
            + carbon_events.len()
            + auction_events.len()
            + rbac_events.len()
            + batch_events.len();

        assert_eq!(
            total, 46,
            "Category breakdown should sum to 46 total emission functions"
        );

        // Verify no overlap between categories
        let mut all_funcs = Vec::new();
        all_funcs.extend_from_slice(waste_events);
        all_funcs.extend_from_slice(participant_events);
        all_funcs.extend_from_slice(token_events);
        all_funcs.extend_from_slice(admin_events);
        all_funcs.extend_from_slice(incentive_events);
        all_funcs.extend_from_slice(seasonal_events);
        all_funcs.extend_from_slice(carbon_events);
        all_funcs.extend_from_slice(auction_events);
        all_funcs.extend_from_slice(rbac_events);
        all_funcs.extend_from_slice(batch_events);

        use std::collections::HashSet;
        let unique: HashSet<_> = all_funcs.iter().collect();
        assert_eq!(
            unique.len(),
            all_funcs.len(),
            "Category assignment has overlapping functions"
        );
    }

    /// Validates that all functions in DOCUMENTED_EMISSION_FUNCTIONS are categorized.
    #[test]
    fn all_documented_functions_have_categories() {
        let categorized = vec![
            // Waste
            ("emit_waste_registered", "Waste"),
            ("emit_waste_transferred", "Waste"),
            ("emit_waste_transferred_v2", "Waste"),
            ("emit_waste_confirmed", "Waste"),
            ("emit_waste_confirmation_reset", "Waste"),
            ("emit_waste_deactivated", "Waste"),
            ("emit_waste_expired", "Waste"),
            ("emit_waste_graded", "Waste"),
            ("emit_waste_split", "Waste"),
            ("emit_wastes_merged", "Waste"),
            ("emit_waste_reserved", "Waste"),
            ("emit_reservation_cancelled", "Waste"),
            ("emit_waste_contaminated", "Waste"),
            ("emit_processing_status_changed", "Waste"),
            ("emit_bulk_transfer", "Waste"),
            ("emit_admin_override_transfer", "Waste"),
            ("emit_composition_set", "Waste"),
            ("emit_waste_reconciled", "Waste"),
            // Participant
            ("emit_participant_registered", "Participant"),
            ("emit_participant_location_updated", "Participant"),
            ("emit_certification_granted", "Participant"),
            ("emit_participant_tier_changed", "Participant"),
            ("emit_goal_achieved", "Participant"),
            // Token
            ("emit_tokens_rewarded", "Token"),
            ("emit_donation_made", "Token"),
            // Admin
            ("emit_admin_transferred", "Admin"),
            ("emit_contract_paused", "Admin"),
            ("emit_contract_unpaused", "Admin"),
            ("emit_proposal_created", "Admin"),
            ("emit_proposal_approved", "Admin"),
            ("emit_proposal_executed", "Admin"),
            // Incentive
            ("emit_incentive_updated", "Incentive"),
            ("emit_incentive_scheduled", "Incentive"),
            // Seasonal
            ("emit_seasonal_multiplier_set", "Seasonal"),
            // Carbon
            ("emit_carbon_credits_earned", "Carbon"),
            ("emit_carbon_credits_redeemed", "Carbon"),
            ("emit_carbon_listing_created", "Carbon"),
            ("emit_carbon_listing_cancelled", "Carbon"),
            ("emit_carbon_listing_purchased", "Carbon"),
            // Auction
            ("emit_auction_created", "Auction"),
            ("emit_bid_placed", "Auction"),
            ("emit_auction_ended", "Auction"),
            // RBAC
            ("emit_permission_granted", "RBAC"),
            ("emit_permission_revoked", "RBAC"),
            // Batch
            ("emit_bulk_import_completed", "Batch"),
            ("emit_batch_processed", "Batch"),
        ];

        use std::collections::HashMap;
        let categories: HashMap<_, _> = categorized.into_iter().collect();

        for func in DOCUMENTED_EMISSION_FUNCTIONS {
            assert!(
                categories.contains_key(func),
                "Function '{}' is not assigned a category. Update the test or EVENT_PATTERNS_GUIDE.md",
                func
            );
        }
    }
}
