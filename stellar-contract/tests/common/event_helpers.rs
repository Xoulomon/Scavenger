//! Event assertion helpers for Soroban contract tests — closes #961.
//!
//! Verbose, copy-pasted event assertions were scattered across many test files.
//! This module centralises them so tests can be written as one-liners.
//!
//! # Usage
//!
//! In any integration test file:
//!
//! ```rust,ignore
//! mod common;
//! use common::event_helpers::*;
//! ```
//!
//! ## Before (verbose, duplicated in every test file)
//!
//! ```rust,ignore
//! let events = env.events().all();
//! let event = events.last().unwrap();
//! let topics: Vec<soroban_sdk::Val> = (symbol_short!("recycled"), waste_id).into_val(&env);
//! assert_eq!(event.1, topics);
//! let data: (WasteType, u128, Address, i128, i128) = event.2.try_into_val(&env).unwrap();
//! assert_eq!(data.0, waste_type);
//! assert_eq!(data.1, weight);
//! // ... more asserts
//! ```
//!
//! ## After (one-liners)
//!
//! ```rust,ignore
//! assert_last_event_topics(&env, (symbol_short!("recycled"), waste_id));
//! assert_last_event_symbol(&env, symbol_short!("recycled"));
//! assert_event_emitted_with_symbol(&env, symbol_short!("recycled"));
//! ```
//!
//! ## Available helpers
//!
//! | Helper | Purpose |
//! |---|---|
//! | `last_event(env)` | Returns the last event; panics with a clear message if none |
//! | `nth_last_event(env, n)` | Returns Nth-from-last event (0 = last) |
//! | `all_events(env)` | All events as a plain Rust `Vec` |
//! | `event_count(env)` | Number of events emitted so far |
//! | `snapshot(env)` | Capture current event count for `events_since` |
//! | `events_since(env, snap)` | Events emitted after a snapshot |
//! | `assert_no_events(env)` | Panics if any events were emitted |
//! | `assert_event_count(env, n)` | Panics unless exactly `n` events were emitted |
//! | `assert_at_least_n_events(env, n)` | Panics unless `>= n` events were emitted |
//! | `assert_last_event_symbol(env, sym)` | Panics unless last event's first topic == `sym` |
//! | `assert_last_event_topics(env, topics)` | Panics unless last event topics equal `topics` |
//! | `assert_nth_last_event_topics(env, n, t)` | Same but for Nth-from-last event |
//! | `assert_event_emitted_with_symbol(env, sym)` | Panics unless any event has `sym` as first topic |

#![allow(dead_code)]

use soroban_sdk::{Env, IntoVal, Symbol, TryIntoVal, Val, Vec as SorobanVec};

// ── Low-level accessors ───────────────────────────────────────────────────────

/// Return all events emitted in `env` as a plain Rust `Vec`.
pub fn all_events(env: &Env) -> std::vec::Vec<(soroban_sdk::Address, SorobanVec<Val>, Val)> {
    env.events().all().iter().collect()
}

/// Number of events emitted so far.
pub fn event_count(env: &Env) -> usize {
    env.events().all().len() as usize
}

/// Return the last event. Panics with a descriptive message if no events exist.
pub fn last_event(env: &Env) -> (soroban_sdk::Address, SorobanVec<Val>, Val) {
    env.events()
        .all()
        .last()
        .expect("expected at least one event to have been emitted, but the event log is empty")
}

/// Return the Nth-from-last event (`n=0` → last, `n=1` → second-to-last, …).
/// Panics if there are fewer than `n + 1` events.
pub fn nth_last_event(env: &Env, n: usize) -> (soroban_sdk::Address, SorobanVec<Val>, Val) {
    let all = env.events().all();
    let len = all.len() as usize;
    assert!(len > n, "expected at least {} event(s), found {}", n + 1, len);
    let idx = (len - 1 - n) as u32;
    all.get(idx).unwrap()
}

/// Take a snapshot of the current event count for use with [`events_since`].
pub fn snapshot(env: &Env) -> usize {
    event_count(env)
}

/// Return the events emitted *after* the given snapshot count.
pub fn events_since(env: &Env, before: usize) -> std::vec::Vec<(soroban_sdk::Address, SorobanVec<Val>, Val)> {
    all_events(env).into_iter().skip(before).collect()
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

/// Assert that no events have been emitted.
#[track_caller]
pub fn assert_no_events(env: &Env) {
    let n = event_count(env);
    assert_eq!(n, 0, "expected 0 events, found {}", n);
}

/// Assert that exactly `expected` events have been emitted.
#[track_caller]
pub fn assert_event_count(env: &Env, expected: usize) {
    let n = event_count(env);
    assert_eq!(n, expected, "expected {} events, found {}", expected, n);
}

/// Assert that at least `min` events have been emitted.
#[track_caller]
pub fn assert_at_least_n_events(env: &Env, min: usize) {
    let n = event_count(env);
    assert!(n >= min, "expected at least {} events, found {}", min, n);
}

/// Assert the last event's first topic is `sym`.
#[track_caller]
pub fn assert_last_event_symbol(env: &Env, sym: Symbol) {
    let (_, topics, _) = last_event(env);
    let first: Symbol = topics
        .get(0)
        .expect("last event has no topics")
        .try_into_val(env)
        .expect("last event's first topic is not a Symbol");
    assert_eq!(first, sym, "last event symbol did not match");
}

/// Assert the last event's topics equal `expected_topics`.
///
/// `expected_topics` can be any tuple that implements `IntoVal<Env, SorobanVec<Val>>`.
///
/// # Example
/// ```rust,ignore
/// assert_last_event_topics(&env, (symbol_short!("recycled"), waste_id));
/// ```
#[track_caller]
pub fn assert_last_event_topics<T: IntoVal<Env, SorobanVec<Val>>>(env: &Env, expected_topics: T) {
    let (_, actual, _) = last_event(env);
    let expected: SorobanVec<Val> = expected_topics.into_val(env);
    assert_eq!(actual, expected, "last event topics did not match expected");
}

/// Assert the topics of the Nth-from-last event equal `expected_topics`.
#[track_caller]
pub fn assert_nth_last_event_topics<T: IntoVal<Env, SorobanVec<Val>>>(env: &Env, n: usize, expected_topics: T) {
    let (_, actual, _) = nth_last_event(env, n);
    let expected: SorobanVec<Val> = expected_topics.into_val(env);
    assert_eq!(actual, expected, "event[nth_last={}] topics did not match expected", n);
}

/// Assert that *any* emitted event has `sym` as its first topic.
///
/// Useful when a multi-step operation emits several events and you only care
/// that one specific kind was fired, regardless of position.
#[track_caller]
pub fn assert_event_emitted_with_symbol(env: &Env, sym: Symbol) {
    let found = env.events().all().iter().any(|(_, topics, _)| {
        if topics.is_empty() {
            return false;
        }
        topics
            .get(0)
            .and_then(|v| Symbol::try_into_val(&v, env).ok())
            .map(|s| s == sym)
            .unwrap_or(false)
    });
    assert!(
        found,
        "no event with first-topic symbol '{:?}' was found in the event log",
        sym
    );
}
