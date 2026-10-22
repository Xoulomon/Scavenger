//! Shared test fixtures for the backend test suite.
//!
//! Fixture data for participants, contracts, and waste batches was previously
//! duplicated across `backend/tests/api`, `backend/tests/middleware`, and
//! `backend/tests/crypto`. This module is the single source of truth for those
//! fixtures so tests can import them instead of redefining their own copies.

pub mod contracts;
pub mod participants;
pub mod waste_batches;

pub use contracts::*;
pub use participants::*;
pub use waste_batches::*;
