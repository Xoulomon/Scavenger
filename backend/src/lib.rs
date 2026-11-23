// lib.rs — re-exports all modules so integration tests in tests/ can use
// `crate::` (or `scavenger_backend::`) paths.
//
// Backwards-compatibility note (issue #1697):
//   The route handlers have been split into controller/service/repository
//   layers. The new `controller` and `repository` modules are additive public
//   module paths; existing paths (`api`, `services`, etc.) remain unchanged so
//   downstream callers and integration tests continue to compile.

pub mod api;
pub mod cache;
pub mod compliance;
pub mod container;
pub mod controller;
pub mod errors;
pub mod logger;
pub mod middleware;
pub mod repository;
pub mod rpc;
pub mod search;
pub mod security;
pub mod services;
pub mod validation;
