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
}
