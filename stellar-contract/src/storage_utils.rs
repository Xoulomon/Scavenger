//! Storage utility helpers for the Scavngr contract.
//!
//! # TTL Policy (issue #924)
//!
//! Soroban has two durable storage types used in this contract:
//!
//! - **Instance storage** – holds global config (admin list, reward config, pause
//!   flag, counters, etc.). A single ledger entry; must be bumped on every call.
//! - **Persistent storage** – holds per-entity records that must outlive the
//!   contract instance TTL (compliance reports, transfer approvals, performance
//!   snapshots). Each key must be bumped individually.
//!
//! ## Ledger constants
//! Assuming ~5 s per ledger:
//! | Duration | Ledgers |
//! |----------|---------|
//! | 30 days  | 518 400 |
//! | 90 days  |1 555 200|
//!
//! Call [`bump_instance`] at the start of **every** externally-callable function.
//! Call [`bump_persistent`] whenever a persistent entry is created or updated.

use soroban_sdk::Env;

// ── Instance storage TTL ──────────────────────────────────────────────────────

/// Keep instance storage alive for at least another 30 days.
/// Should be called at the start of every externally-invokable contract function.
pub fn bump_instance(env: &Env) {
    // ~30 days at 5 s/ledger
    const INSTANCE_LIFETIME_THRESHOLD: u32 = 518_400;
    const INSTANCE_BUMP_AMOUNT: u32 = 518_400;
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

// ── Persistent storage TTL ────────────────────────────────────────────────────

/// Keep a persistent storage entry alive for at least another 90 days.
///
/// Persistent entries are used for compliance reports, performance snapshots,
/// and transfer-approval records. They must survive longer than the instance TTL.
///
/// # Parameters
/// - `key`: The storage key (same value you pass to `env.storage().persistent().set`).
pub fn bump_persistent<K: soroban_sdk::TryIntoVal<Env, soroban_sdk::Val>>(env: &Env, key: &K) {
    // ~90 days at 5 s/ledger
    const PERSISTENT_LIFETIME_THRESHOLD: u32 = 1_555_200;
    const PERSISTENT_BUMP_AMOUNT: u32 = 1_555_200;
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_LIFETIME_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
}
