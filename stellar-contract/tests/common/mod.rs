//! Shared utilities for Soroban contract integration tests.
//!
//! Import in any test file with:
//! ```rust,ignore
//! mod common;
//! use common::event_helpers::*;
//! ```
//!
//! Because each file in `tests/` compiles as its own crate, this module is
//! included via `mod common;` inside each test file that needs it.

pub mod event_helpers;
pub mod setup;
