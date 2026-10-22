//! Canonical Soroban contract types, organized by domain.

use soroban_sdk::{contracttype, Address, String, Symbol};

mod analytics;
pub use analytics::*;
mod compliance;
pub use compliance::*;
mod engagement;
pub use engagement::*;
mod incentives;
pub use incentives::*;
mod marketplace;
pub use marketplace::*;
mod participants;
pub use participants::*;
mod permissions;
pub use permissions::*;
mod transfers;
pub use transfers::*;
mod waste;
pub use waste::*;

#[cfg(test)]
mod serialization_tests;
#[cfg(test)]
mod tests;
