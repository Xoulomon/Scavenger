//! Stellar RPC access layer — created as part of issue #907.
//!
//! All Horizon and Soroban RPC interactions must go through [`StellarRpcClient`].
//! Direct `reqwest` calls in handlers are not permitted.

pub mod client;
#[cfg(test)]
mod error_injection_tests;

pub use client::{
    Balance, ContractDataEntry, LatestLedger, RetryConfig, RpcError, StellarAccount, StellarRpcClient,
    StellarRpcConfig, TransactionResult,
};
