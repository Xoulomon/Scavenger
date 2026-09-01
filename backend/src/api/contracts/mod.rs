/// Contract-API submodules (issue #1075).
///
/// Previously all contract-related handlers lived in a single `contracts.rs`
/// file which became a merge-conflict hotspot.  They are now split into
/// focused resource modules:
///
/// | Module       | Responsibility                                  |
/// |-------------|--------------------------------------------------|
/// | `waste`     | Register, transfer, list, and update waste records |
/// | `incentive` | Distribute, claim, balance, and programme queries  |
///
/// Route registration is delegated to each module's `configure_*_routes`
/// function, keeping this file limited to re-exports and the top-level
/// scope mount.
pub mod incentive;
pub mod waste;

use actix_web::web;

/// Mounts all contract routes under `/api/contracts`.
///
/// Called from `api::mod.rs` during application startup.
pub fn configure_contract_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/contracts")
            .configure(waste::configure_waste_routes)
            .configure(incentive::configure_incentive_routes),
    );
}
