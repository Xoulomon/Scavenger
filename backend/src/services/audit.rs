use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::Mutex;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AuditEventType {
    Contract,
    Admin,
    System,
    Security,
    Export,
}

impl std::fmt::Display for AuditEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditEventType::Contract => write!(f, "contract"),
            AuditEventType::Admin => write!(f, "admin"),
            AuditEventType::System => write!(f, "system"),
            AuditEventType::Security => write!(f, "security"),
            AuditEventType::Export => write!(f, "export"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AuditAction {
    Create,
    Update,
    Delete,
    Read,
    Approve,
    Reject,
    Login,
    Logout,
    Export,
}

impl std::fmt::Display for AuditAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditAction::Create => write!(f, "create"),
            AuditAction::Update => write!(f, "update"),
            AuditAction::Delete => write!(f, "delete"),
            AuditAction::Read => write!(f, "read"),
            AuditAction::Approve => write!(f, "approve"),
            AuditAction::Reject => write!(f, "reject"),
            AuditAction::Login => write!(f, "login"),
            AuditAction::Logout => write!(f, "logout"),
            AuditAction::Export => write!(f, "export"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub event_type: String,
    pub action: String,
    pub user_id: String,
    pub resource_type: String,
    pub resource_id: Option<String>,
    pub details: String,
    pub timestamp: DateTime<Utc>,
    pub ip_address: String,
    pub user_agent: Option<String>,
    pub severity: String,
    pub changes: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct AuditQuery {
    pub event_type: Option<AuditEventType>,
    pub user_id: Option<String>,
    pub action: Option<AuditAction>,
    pub resource_type: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub severity: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditSummary {
    pub total_entries: u64,
    pub by_event_type: HashMap<String, u64>,
    pub by_severity: HashMap<String, u64>,
    pub by_action: HashMap<String, u64>,
    pub oldest_entry: Option<String>,
    pub newest_entry: Option<String>,
    pub entries_last_24h: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditReport {
    pub generated_at: String,
    pub period_start: String,
    pub period_end: String,
    pub total_entries: u64,
    pub entries_by_event_type: HashMap<String, u64>,
    pub entries_by_action: HashMap<String, u64>,
    pub entries_by_user: HashMap<String, u64>,
    pub entries_by_day: HashMap<String, u64>,
    pub top_users: Vec<(String, u64)>,
    pub top_actions: Vec<(String, u64)>,
}

/// Read-only audit view. This service only inspects persisted entries and never
/// appends or mutates audit state. It is intended for query, summary, report, and
/// export endpoints.
#[derive(Clone)]
pub struct AuditReadService {
    entries: std::sync::Arc<Mutex<Vec<AuditEntry>>>,
}

// ── #1158: Extracted filter predicates for AuditReadService::query() ─────────

/// #1158: extracted from query()
/// Returns true when the entry matches the optional event_type filter.
fn matches_event_type(entry: &AuditEntry, filter: &Option<AuditEventType>) -> bool {
    filter
        .as_ref()
        .map_or(true, |et| entry.event_type == et.to_string())
}

/// #1158: extracted from query()
/// Returns true when the entry matches the optional user_id substring filter.
fn matches_user_id(entry: &AuditEntry, filter: &Option<String>) -> bool {
    filter
        .as_ref()
        .map_or(true, |uid| entry.user_id.contains(uid.as_str()))
}

/// #1158: extracted from query()
/// Returns true when the entry matches the optional action filter.
fn matches_action(entry: &AuditEntry, filter: &Option<AuditAction>) -> bool {
    filter
        .as_ref()
        .map_or(true, |a| entry.action == a.to_string())
}

/// #1158: extracted from query()
/// Returns true when the entry matches the optional resource_type filter.
fn matches_resource_type(entry: &AuditEntry, filter: &Option<String>) -> bool {
    filter
        .as_ref()
        .map_or(true, |rt| entry.resource_type == *rt)
}

/// #1158: extracted from query()
/// Returns true when the entry timestamp is on or after the optional start date.
fn matches_start_date(entry: &AuditEntry, filter: &Option<DateTime<Utc>>) -> bool {
    filter.as_ref().map_or(true, |sd| entry.timestamp >= *sd)
}

/// #1158: extracted from query()
/// Returns true when the entry timestamp is on or before the optional end date.
fn matches_end_date(entry: &AuditEntry, filter: &Option<DateTime<Utc>>) -> bool {
    filter.as_ref().map_or(true, |ed| entry.timestamp <= *ed)
}

/// #1158: extracted from query()
/// Returns true when the entry matches the optional severity filter.
fn matches_severity(entry: &AuditEntry, filter: &Option<String>) -> bool {
    filter.as_ref().map_or(true, |s| entry.severity == *s)
}

/// #1158: extracted from query()
/// Returns true only when an entry passes ALL filter fields in `query`.
fn entry_matches_query(entry: &AuditEntry, query: &AuditQuery) -> bool {
    matches_event_type(entry, &query.event_type)
        && matches_user_id(entry, &query.user_id)
        && matches_action(entry, &query.action)
        && matches_resource_type(entry, &query.resource_type)
        && matches_start_date(entry, &query.start_date)
        && matches_end_date(entry, &query.end_date)
        && matches_severity(entry, &query.severity)
}

impl AuditReadService {
    pub fn query(&self, query: AuditQuery) -> Vec<AuditEntry> {
        let entries = self.entries.lock().unwrap();
        let mut filtered: Vec<AuditEntry> = entries
            .iter()
            .filter(|e| entry_matches_query(e, &query))
            .cloned()
            .collect();

        filtered.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        let offset = query.offset.unwrap_or(0) as usize;
        let limit = query.limit.unwrap_or(u32::MAX) as usize;

        if offset < filtered.len() {
            let end = (offset + limit).min(filtered.len());
            filtered[offset..end].to_vec()
        } else {
            Vec::new()
        }
    }

    pub fn get_entry(&self, id: &str) -> Option<AuditEntry> {
        let entries = self.entries.lock().unwrap();
        entries.iter().find(|e| e.id == id).cloned()
    }

    pub fn get_summary(&self) -> AuditSummary {
        let entries = self.entries.lock().unwrap();
        let total = entries.len() as u64;
        let mut by_event_type: HashMap<String, u64> = HashMap::new();
        let mut by_severity: HashMap<String, u64> = HashMap::new();
        let mut by_action: HashMap<String, u64> = HashMap::new();
        let now = Utc::now();
        let mut entries_last_24h = 0u64;

        for entry in entries.iter() {
            *by_event_type.entry(entry.event_type.clone()).or_insert(0) += 1;
            *by_severity.entry(entry.severity.clone()).or_insert(0) += 1;
            *by_action.entry(entry.action.clone()).or_insert(0) += 1;

            if now.signed_duration_since(entry.timestamp) < Duration::hours(24) {
                entries_last_24h += 1;
            }
        }

        AuditSummary {
            total_entries: total,
            by_event_type,
            by_severity,
            by_action,
            oldest_entry: entries.first().map(|e| e.timestamp.to_rfc3339()),
            newest_entry: entries.last().map(|e| e.timestamp.to_rfc3339()),
            entries_last_24h,
        }
    }

    pub fn generate_report(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        event_types: Option<Vec<AuditEventType>>,
        group_by: Option<String>,
    ) -> AuditReport {
        let entries = self.entries.lock().unwrap();
        let relevant: Vec<&AuditEntry> = entries
            .iter()
            .filter(|e| {
                e.timestamp >= start
                    && e.timestamp <= end
                    && event_types
                        .as_ref()
                        .map(|types| types.iter().any(|t| t.to_string() == e.event_type))
                        .unwrap_or(true)
            })
            .collect();

        let total = relevant.len() as u64;
        let mut by_event_type: HashMap<String, u64> = HashMap::new();
        let mut by_action: HashMap<String, u64> = HashMap::new();
        let mut by_user: HashMap<String, u64> = HashMap::new();
        let mut by_day: HashMap<String, u64> = HashMap::new();

        for entry in &relevant {
            *by_event_type.entry(entry.event_type.clone()).or_insert(0) += 1;
            *by_action.entry(entry.action.clone()).or_insert(0) += 1;
            *by_user.entry(entry.user_id.clone()).or_insert(0) += 1;
            let day = entry.timestamp.format("%Y-%m-%d").to_string();
            *by_day.entry(day).or_insert(0) += 1;
        }

        let mut top_users: Vec<(String, u64)> = by_user.into_iter().collect();
        top_users.sort_by(|a, b| b.1.cmp(&a.1));
        top_users.truncate(10);

        let mut top_actions: Vec<(String, u64)> = by_action.clone().into_iter().collect();
        top_actions.sort_by(|a, b| b.1.cmp(&a.1));
        top_actions.truncate(10);

        AuditReport {
            generated_at: Utc::now().to_rfc3339(),
            period_start: start.to_rfc3339(),
            period_end: end.to_rfc3339(),
            total_entries: total,
            entries_by_event_type: by_event_type,
            entries_by_action: by_action,
            entries_by_user: HashMap::new(),
            entries_by_day: by_day,
            top_users,
            top_actions,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRule {
    pub id: String,
    pub event_type: String,
    pub threshold: u32,
    pub time_window_minutes: u64,
    pub notification_email: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    pub max_age_days: u64,
    pub max_entries: u64,
    pub archive_enabled: bool,
}

impl Default for RetentionPolicy {
    fn default() -> Self {
        Self {
            max_age_days: 365,
            max_entries: 10_000_000,
            archive_enabled: true,
        }
    }
}

/// Write-only audit service. This path is responsible for appending entries to the
/// audit trail, enforcing retention policy updates, and alert bookkeeping. It is
/// intentionally decoupled from the read/report/export logic above.
#[derive(Clone)]
pub struct AuditWriteService {
    entries: std::sync::Arc<Mutex<Vec<AuditEntry>>>,
    alert_rules: std::sync::Arc<Mutex<Vec<AlertRule>>>,
    retention_policy: std::sync::Arc<Mutex<RetentionPolicy>>,
    alert_counters: std::sync::Arc<Mutex<HashMap<String, Vec<DateTime<Utc>>>>>,
}

impl AuditWriteService {
    pub fn log_entry(
        &self,
        event_type: AuditEventType,
        action: AuditAction,
        user_id: &str,
        resource_type: &str,
        details: &str,
        ip_address: &str,
        severity: &str,
    ) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let entry = AuditEntry {
            id: id.clone(),
            event_type: event_type.to_string(),
            action: action.to_string(),
            user_id: user_id.to_string(),
            resource_type: resource_type.to_string(),
            resource_id: None,
            details: details.to_string(),
            timestamp: Utc::now(),
            ip_address: ip_address.to_string(),
            user_agent: None,
            severity: severity.to_string(),
            changes: None,
        };

        if let Ok(mut entries) = self.entries.lock() {
            entries.push(entry.clone());
            self.persist_to_file(&entry);
            self.check_alerts(&event_type);
        }

        info!(
            user = %user_id,
            action = %action,
            resource = %resource_type,
            "Audit log entry created"
        );

        id
    }

    fn persist_to_file(&self, entry: &AuditEntry) {
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open("/tmp/audit.log")
        {
            if let Ok(line) = serde_json::to_string(entry) {
                let _ = writeln!(file, "{}", line);
            }
        }
    }

    pub fn log_entry_with_changes(
        &self,
        event_type: AuditEventType,
        action: AuditAction,
        user_id: &str,
        resource_type: &str,
        resource_id: &str,
        details: &str,
        ip_address: &str,
        user_agent: Option<String>,
        severity: &str,
        changes: HashMap<String, serde_json::Value>,
    ) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let entry = AuditEntry {
            id: id.clone(),
            event_type: event_type.to_string(),
            action: action.to_string(),
            user_id: user_id.to_string(),
            resource_type: resource_type.to_string(),
            resource_id: Some(resource_id.to_string()),
            details: details.to_string(),
            timestamp: Utc::now(),
            ip_address: ip_address.to_string(),
            user_agent,
            severity: severity.to_string(),
            changes: Some(changes),
        };

        if let Ok(mut entries) = self.entries.lock() {
            entries.push(entry.clone());
            self.check_alerts(&event_type);
            self.persist_to_file(&entry);
        }

        id
    }

    pub fn add_alert_rule(&self, rule: AlertRule) {
        if let Ok(mut rules) = self.alert_rules.lock() {
            rules.push(rule);
        }
    }

    pub fn get_alert_rules(&self) -> Vec<AlertRule> {
        self.alert_rules.lock().unwrap().clone()
    }

    fn check_alerts(&self, event_type: &AuditEventType) {
        let rules = self.alert_rules.lock().unwrap();
        let now = Utc::now();

        for rule in rules.iter() {
            if !rule.enabled || rule.event_type != event_type.to_string() {
                continue;
            }

            let mut counters = self.alert_counters.lock().unwrap();
            let events = counters.entry(rule.id.clone()).or_default();
            events.push(now);
            events.retain(|t| now.signed_duration_since(*t) < Duration::minutes(rule.time_window_minutes as i64));

            if events.len() as u32 >= rule.threshold {
                info!(
                    rule_id = %rule.id,
                    event_type = %rule.event_type,
                    count = %events.len(),
                    threshold = %rule.threshold,
                    "Audit alert threshold reached"
                );
            }
        }
    }

    pub fn get_retention_policy(&self) -> RetentionPolicy {
        self.retention_policy.lock().unwrap().clone()
    }

    pub fn set_retention_policy(&self, policy: RetentionPolicy) {
        if let Ok(mut p) = self.retention_policy.lock() {
            *p = policy;
        }
    }

    pub fn purge_old_entries(&self) -> u64 {
        let policy = self.retention_policy.lock().unwrap();
        let cutoff = Utc::now() - Duration::days(policy.max_age_days as i64);

        let mut entries = self.entries.lock().unwrap();
        let before = entries.len();
        entries.retain(|e| e.timestamp > cutoff);

        if entries.len() as u64 > policy.max_entries {
            entries.truncate(policy.max_entries as usize);
        }

        let purged = (before - entries.len()) as u64;
        info!(purged = %purged, "Audit log purged old entries");
        purged
    }
}

#[derive(Clone)]
pub struct AuditService {
    entries: std::sync::Arc<Mutex<Vec<AuditEntry>>>,
    alert_rules: std::sync::Arc<Mutex<Vec<AlertRule>>>,
    retention_policy: std::sync::Arc<Mutex<RetentionPolicy>>,
    alert_counters: std::sync::Arc<Mutex<HashMap<String, Vec<DateTime<Utc>>>>>,
}

impl AuditService {
    pub fn new() -> Self {
        let policy = RetentionPolicy::default();
        info!(
            "AuditService initialized with retention policy: max_age={}d, max_entries={}",
            policy.max_age_days, policy.max_entries
        );
        Self {
            entries: std::sync::Arc::new(Mutex::new(Vec::new())),
            alert_rules: std::sync::Arc::new(Mutex::new(Vec::new())),
            retention_policy: std::sync::Arc::new(Mutex::new(policy)),
            alert_counters: std::sync::Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn read_service(&self) -> AuditReadService {
        AuditReadService {
            entries: std::sync::Arc::clone(&self.entries),
        }
    }

    pub fn write_service(&self) -> AuditWriteService {
        AuditWriteService {
            entries: std::sync::Arc::clone(&self.entries),
            alert_rules: std::sync::Arc::clone(&self.alert_rules),
            retention_policy: std::sync::Arc::clone(&self.retention_policy),
            alert_counters: std::sync::Arc::clone(&self.alert_counters),
        }
    }

    pub fn log_entry(
        &self,
        event_type: AuditEventType,
        action: AuditAction,
        user_id: &str,
        resource_type: &str,
        details: &str,
        ip_address: &str,
        severity: &str,
    ) -> String {
        self.write_service().log_entry(event_type, action, user_id, resource_type, details, ip_address, severity)
    }

    pub fn log_entry_with_changes(
        &self,
        event_type: AuditEventType,
        action: AuditAction,
        user_id: &str,
        resource_type: &str,
        resource_id: &str,
        details: &str,
        ip_address: &str,
        user_agent: Option<String>,
        severity: &str,
        changes: HashMap<String, serde_json::Value>,
    ) -> String {
        self.write_service().log_entry_with_changes(
            event_type,
            action,
            user_id,
            resource_type,
            resource_id,
            details,
            ip_address,
            user_agent,
            severity,
            changes,
        )
    }

    pub fn query(&self, query: AuditQuery) -> Vec<AuditEntry> {
        self.read_service().query(query)
    }

    pub fn get_entry(&self, id: &str) -> Option<AuditEntry> {
        self.read_service().get_entry(id)
    }

    pub fn get_summary(&self) -> AuditSummary {
        self.read_service().get_summary()
    }

    pub fn generate_report(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        event_types: Option<Vec<AuditEventType>>,
        group_by: Option<String>,
    ) -> AuditReport {
        self.read_service().generate_report(start, end, event_types, group_by)
    }

    pub fn add_alert_rule(&self, rule: AlertRule) {
        self.write_service().add_alert_rule(rule)
    }

    pub fn get_alert_rules(&self) -> Vec<AlertRule> {
        self.write_service().get_alert_rules()
    }

    pub fn get_retention_policy(&self) -> RetentionPolicy {
        self.write_service().get_retention_policy()
    }

    pub fn set_retention_policy(&self, policy: RetentionPolicy) {
        self.write_service().set_retention_policy(policy)
    }

    pub fn purge_old_entries(&self) -> u64 {
        self.write_service().purge_old_entries()
    }
}

impl Default for AuditService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    // ── Helpers for predicate tests ────────────────────────────────────────────

    fn make_entry(
        event_type: &str,
        action: &str,
        user_id: &str,
        resource_type: &str,
        severity: &str,
        timestamp: DateTime<Utc>,
    ) -> AuditEntry {
        AuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: event_type.to_string(),
            action: action.to_string(),
            user_id: user_id.to_string(),
            resource_type: resource_type.to_string(),
            resource_id: None,
            details: "test".to_string(),
            timestamp,
            ip_address: "127.0.0.1".to_string(),
            user_agent: None,
            severity: severity.to_string(),
            changes: None,
        }
    }

    fn base_entry() -> AuditEntry {
        make_entry(
            "contract",
            "create",
            "user-001",
            "waste",
            "low",
            Utc::now(),
        )
    }

    // ── #1158: predicate unit tests ────────────────────────────────────────────

    #[test]
    fn test_matches_event_type_none_passes_all() {
        let e = base_entry();
        assert!(matches_event_type(&e, &None));
    }

    #[test]
    fn test_matches_event_type_match() {
        let e = base_entry();
        assert!(matches_event_type(&e, &Some(AuditEventType::Contract)));
    }

    #[test]
    fn test_matches_event_type_no_match() {
        let e = base_entry();
        assert!(!matches_event_type(&e, &Some(AuditEventType::Admin)));
    }

    #[test]
    fn test_matches_user_id_none_passes_all() {
        let e = base_entry();
        assert!(matches_user_id(&e, &None));
    }

    #[test]
    fn test_matches_user_id_substring() {
        let e = base_entry(); // user_id = "user-001"
        assert!(matches_user_id(&e, &Some("user".to_string())));
        assert!(matches_user_id(&e, &Some("001".to_string())));
        assert!(!matches_user_id(&e, &Some("admin".to_string())));
    }

    #[test]
    fn test_matches_action_none_passes_all() {
        let e = base_entry();
        assert!(matches_action(&e, &None));
    }

    #[test]
    fn test_matches_action_match() {
        let e = base_entry(); // action = "create"
        assert!(matches_action(&e, &Some(AuditAction::Create)));
    }

    #[test]
    fn test_matches_action_no_match() {
        let e = base_entry();
        assert!(!matches_action(&e, &Some(AuditAction::Delete)));
    }

    #[test]
    fn test_matches_resource_type_none_passes_all() {
        let e = base_entry();
        assert!(matches_resource_type(&e, &None));
    }

    #[test]
    fn test_matches_resource_type_match() {
        let e = base_entry(); // resource_type = "waste"
        assert!(matches_resource_type(&e, &Some("waste".to_string())));
    }

    #[test]
    fn test_matches_resource_type_no_match() {
        let e = base_entry();
        assert!(!matches_resource_type(&e, &Some("config".to_string())));
    }

    #[test]
    fn test_matches_start_date_none_passes_all() {
        let e = base_entry();
        assert!(matches_start_date(&e, &None));
    }

    #[test]
    fn test_matches_start_date_before_timestamp_passes() {
        let ts = Utc::now();
        let e = make_entry("contract", "create", "u", "waste", "low", ts);
        let start = ts - Duration::hours(1);
        assert!(matches_start_date(&e, &Some(start)));
    }

    #[test]
    fn test_matches_start_date_after_timestamp_fails() {
        let ts = Utc::now();
        let e = make_entry("contract", "create", "u", "waste", "low", ts);
        let start = ts + Duration::hours(1);
        assert!(!matches_start_date(&e, &Some(start)));
    }

    #[test]
    fn test_matches_end_date_none_passes_all() {
        let e = base_entry();
        assert!(matches_end_date(&e, &None));
    }

    #[test]
    fn test_matches_end_date_after_timestamp_passes() {
        let ts = Utc::now();
        let e = make_entry("contract", "create", "u", "waste", "low", ts);
        let end = ts + Duration::hours(1);
        assert!(matches_end_date(&e, &Some(end)));
    }

    #[test]
    fn test_matches_end_date_before_timestamp_fails() {
        let ts = Utc::now();
        let e = make_entry("contract", "create", "u", "waste", "low", ts);
        let end = ts - Duration::hours(1);
        assert!(!matches_end_date(&e, &Some(end)));
    }

    #[test]
    fn test_matches_severity_none_passes_all() {
        let e = base_entry();
        assert!(matches_severity(&e, &None));
    }

    #[test]
    fn test_matches_severity_match() {
        let e = base_entry(); // severity = "low"
        assert!(matches_severity(&e, &Some("low".to_string())));
    }

    #[test]
    fn test_matches_severity_no_match() {
        let e = base_entry();
        assert!(!matches_severity(&e, &Some("high".to_string())));
    }

    #[test]
    fn test_entry_matches_query_all_none_passes() {
        let e = base_entry();
        let q = AuditQuery {
            event_type: None,
            user_id: None,
            action: None,
            resource_type: None,
            start_date: None,
            end_date: None,
            severity: None,
            limit: None,
            offset: None,
        };
        assert!(entry_matches_query(&e, &q));
    }

    #[test]
    fn test_entry_matches_query_one_fail_rejects() {
        let e = base_entry(); // event_type = "contract"
        let q = AuditQuery {
            event_type: Some(AuditEventType::Admin), // won't match
            user_id: None,
            action: None,
            resource_type: None,
            start_date: None,
            end_date: None,
            severity: None,
            limit: None,
            offset: None,
        };
        assert!(!entry_matches_query(&e, &q));
    }

    #[test]
    fn test_audit_log_entry() {
        let service = AuditService::new();
        let id = service.log_entry(
            AuditEventType::Contract,
            AuditAction::Create,
            "user-001",
            "waste",
            "Created waste record",
            "192.168.1.1",
            "medium",
        );
        assert!(!id.is_empty());
    }

    #[test]
    fn test_audit_entries_are_immutable_after_write() {
        let service = AuditService::new();
        let id = service.log_entry(
            AuditEventType::Security,
            AuditAction::Approve,
            "user-immutable",
            "verification",
            "Approved verification",
            "127.0.0.1",
            "high",
        );

        let entry = service.get_entry(&id).expect("entry should be present");
        assert_eq!(entry.user_id, "user-immutable");
        assert_eq!(entry.action, "approve");
        assert_eq!(entry.event_type, "security");

        let same_entry = service.read_service().get_entry(&id).expect("read service should see same immutable record");
        assert_eq!(same_entry.id, entry.id);
        assert_eq!(same_entry.timestamp, entry.timestamp);
    }

    #[test]
    fn test_audit_read_service_does_not_mutate_state() {
        let service = AuditService::new();
        service.log_entry(
            AuditEventType::System,
            AuditAction::Login,
            "reader-test",
            "session",
            "login succeeded",
            "127.0.0.1",
            "low",
        );

        let reader = service.read_service();
        let entries = reader.query(AuditQuery {
            event_type: Some(AuditEventType::System),
            user_id: None,
            action: None,
            resource_type: None,
            start_date: None,
            end_date: None,
            severity: None,
            limit: None,
            offset: None,
        });

        assert_eq!(entries.len(), 1);
        assert_eq!(service.get_summary().total_entries, 1);
    }

    #[test]
    fn test_query_by_event_type() {
        let service = AuditService::new();
        service.log_entry(
            AuditEventType::Contract,
            AuditAction::Create,
            "user-001",
            "waste",
            "test",
            "127.0.0.1",
            "low",
        );
        service.log_entry(
            AuditEventType::Admin,
            AuditAction::Update,
            "admin-001",
            "config",
            "test",
            "127.0.0.1",
            "high",
        );

        let results = service.query(AuditQuery {
            event_type: Some(AuditEventType::Contract),
            user_id: None,
            action: None,
            resource_type: None,
            start_date: None,
            end_date: None,
            severity: None,
            limit: None,
            offset: None,
        });
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].event_type, "contract");
    }

    #[test]
    fn test_query_pagination() {
        let service = AuditService::new();
        for i in 0..10 {
            service.log_entry(
                AuditEventType::System,
                AuditAction::Read,
                &format!("user-{:03}", i),
                "report",
                "test",
                "127.0.0.1",
                "low",
            );
        }

        let page1 = service.query(AuditQuery {
            event_type: None,
            user_id: None,
            action: None,
            resource_type: None,
            start_date: None,
            end_date: None,
            severity: None,
            limit: Some(3),
            offset: Some(0),
        });
        assert_eq!(page1.len(), 3);

        let page2 = service.query(AuditQuery {
            event_type: None,
            user_id: None,
            action: None,
            resource_type: None,
            start_date: None,
            end_date: None,
            severity: None,
            limit: Some(3),
            offset: Some(3),
        });
        assert_eq!(page2.len(), 3);
    }

    #[test]
    fn test_summary() {
        let service = AuditService::new();
        service.log_entry(
            AuditEventType::Contract,
            AuditAction::Create,
            "user-001",
            "waste",
            "test",
            "127.0.0.1",
            "medium",
        );
        service.log_entry(
            AuditEventType::Admin,
            AuditAction::Update,
            "admin-001",
            "config",
            "test",
            "127.0.0.1",
            "high",
        );

        let summary = service.get_summary();
        assert_eq!(summary.total_entries, 2);
        assert_eq!(*summary.by_event_type.get("contract").unwrap(), 1);
        assert_eq!(*summary.by_event_type.get("admin").unwrap(), 1);
    }

    #[test]
    fn test_retention_policy() {
        let service = AuditService::new();
        let default = service.get_retention_policy();
        assert_eq!(default.max_age_days, 365);

        service.set_retention_policy(RetentionPolicy {
            max_age_days: 90,
            max_entries: 1000,
            archive_enabled: true,
        });
        let updated = service.get_retention_policy();
        assert_eq!(updated.max_age_days, 90);
    }

    #[test]
    fn test_alert_rules() {
        let service = AuditService::new();
        let rule = AlertRule {
            id: "rule-001".to_string(),
            event_type: "security".to_string(),
            threshold: 10,
            time_window_minutes: 60,
            notification_email: Some("admin@test.com".to_string()),
            enabled: true,
        };
        service.add_alert_rule(rule.clone());
        let rules = service.get_alert_rules();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].id, "rule-001");
    }

    #[test]
    fn test_generate_report() {
        let service = AuditService::new();
        service.log_entry(
            AuditEventType::Contract,
            AuditAction::Create,
            "user-001",
            "waste",
            "test",
            "127.0.0.1",
            "medium",
        );
        service.log_entry(
            AuditEventType::Admin,
            AuditAction::Update,
            "user-001",
            "config",
            "test",
            "127.0.0.1",
            "high",
        );

        let start = Utc::now() - Duration::hours(1);
        let end = Utc::now() + Duration::hours(1);
        let report = service.generate_report(start, end, None, None);
        assert_eq!(report.total_entries, 2);
    }

    #[test]
    fn test_purge_old_entries() {
        let service = AuditService::new();
        service.set_retention_policy(RetentionPolicy {
            max_age_days: 0,
            max_entries: 10_000_000,
            archive_enabled: true,
        });

        service.log_entry(
            AuditEventType::Contract,
            AuditAction::Create,
            "user-001",
            "waste",
            "test",
            "127.0.0.1",
            "low",
        );

        let purged = service.purge_old_entries();
        assert_eq!(purged, 1);
    }

    #[test]
    fn test_entry_with_changes() {
        let service = AuditService::new();
        let mut changes = HashMap::new();
        changes.insert(
            "status".to_string(),
            serde_json::json!({"from": "pending", "to": "approved"}),
        );

        let id = service.log_entry_with_changes(
            AuditEventType::Contract,
            AuditAction::Approve,
            "admin-001",
            "waste",
            "waste-001",
            "Approved waste transfer",
            "10.0.0.1",
            Some("Mozilla/5.0".to_string()),
            "high",
            changes,
        );

        let entry = service.get_entry(&id).unwrap();
        assert_eq!(entry.resource_id, Some("waste-001".to_string()));
        assert_eq!(entry.user_agent, Some("Mozilla/5.0".to_string()));
        assert!(entry.changes.is_some());
    }
}
