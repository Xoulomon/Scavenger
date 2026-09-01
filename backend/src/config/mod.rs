//! Configuration module
//!
//! This module provides configuration structures for the application.
//! All configuration is loaded from environment variables.
//!
//! # Design rule (#1159)
//!
//! Every `std::env::var` call must live in one of:
//! * [`app`] — application-level knobs (logging, CORS, CSRF, Redis URL)
//! * [`rate_limit`] — rate-limiting thresholds
//! * [`crate::container`] — service-level secrets (API keys, S3 bucket, etc.)
//! * [`crate::rpc::client`] — Stellar RPC endpoints
//!
//! **No handler or middleware may call `std::env::var` directly.**

pub mod app;
pub mod rate_limit;

pub use app::AppConfig;
