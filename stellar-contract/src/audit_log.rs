//! Audit logging service for tracking contract actions.
use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone)]
pub struct AuditLog {
    pub id: u64,
    pub action: String,
    pub actor: Address,
    pub target: String,
    pub timestamp: u64,
    pub details: String,
}

#[contracttype]
pub struct AuditLogFilter {
    pub action: Option<String>,
    pub actor: Option<Address>,
    pub start_time: Option<u64>,
    pub end_time: Option<u64>,
}

pub struct AuditLogService;

impl AuditLogService {
    /// Log a sensitive operation by emitting a contract event.
    ///
    /// Using events instead of persistent storage avoids the expensive
    /// read-modify-write cycle of a growing Vec (gas optimization #768).
    /// Events are queryable off-chain via the Stellar RPC `getEvents` API.
    pub fn log_action(
        env: &Env,
        action: String,
        actor: Address,
        target: String,
        details: String,
    ) {
        let log_id_key = symbol_short!("audit_id");
        let current_id: u64 = env
            .storage()
            .instance()
            .get(&log_id_key)
            .unwrap_or(0u64);
        let new_id = current_id + 1;
        env.storage().instance().set(&log_id_key, &new_id);

        let log = AuditLog {
            id: new_id,
            action,
            actor,
            target,
            timestamp: env.ledger().timestamp(),
            details,
        };

        // Emit as event — zero persistent storage write for the log body.
        // Indexers capture these via getEvents and persist in audit_logs table.
        env.events()
            .publish((symbol_short!("AUDIT"), symbol_short!("log")), log);
    }

    /// Returns empty Vec — audit logs are stored off-chain via events.
    pub fn get_logs(env: &Env) -> Vec<AuditLog> {
        Vec::new(env)
    }

    /// Returns empty Vec — use off-chain event queries for filtering.
    pub fn search_logs(env: &Env, _filter: AuditLogFilter) -> Vec<AuditLog> {
        Vec::new(env)
    }

    /// Returns empty Vec — use off-chain event queries for export.
    pub fn export_logs(env: &Env) -> Vec<AuditLog> {
        Vec::new(env)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_log_creation() {
        let env = soroban_sdk::Env::default();
        let log = AuditLog {
            id: 1,
            action: String::from_str(&env, "test"),
            actor: Address::generate(&env),
            target: String::from_str(&env, "target"),
            timestamp: 1000,
            details: String::from_str(&env, "details"),
        };
        assert_eq!(log.id, 1);
    }

    #[test]
    fn test_audit_log_filter() {
        let filter = AuditLogFilter {
            action: None,
            actor: None,
            start_time: None,
            end_time: None,
        };
        assert!(filter.action.is_none());
    }
}
