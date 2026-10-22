//! Comprehensive integration tests for the audit service module
//! Tests for audit entries, queries, summaries, and report generation

use scavenger_backend::services::audit::{
    AuditEntry, AuditEventType, AuditAction, AuditQuery, AuditSummary, AuditReport,
};
use chrono::Utc;
use std::collections::HashMap;

// ── Helper functions for test data ───────────────────────────────────────────

fn valid_audit_entry() -> AuditEntry {
    AuditEntry {
        id: "audit_001".to_string(),
        event_type: "contract".to_string(),
        action: "create".to_string(),
        user_id: "user_001".to_string(),
        resource_type: "waste_item".to_string(),
        resource_id: Some("res_001".to_string()),
        details: "Created new waste item".to_string(),
        timestamp: Utc::now(),
        ip_address: "192.168.1.1".to_string(),
        user_agent: Some("Mozilla/5.0".to_string()),
        severity: "info".to_string(),
        changes: None,
    }
}

fn valid_audit_query() -> AuditQuery {
    AuditQuery {
        event_type: None,
        user_id: None,
        action: None,
        resource_type: None,
        start_date: None,
        end_date: None,
        severity: None,
        limit: Some(100),
        offset: Some(0),
    }
}

fn valid_audit_summary() -> AuditSummary {
    AuditSummary {
        total_entries: 1000,
        by_event_type: HashMap::from([
            ("contract".to_string(), 500),
            ("admin".to_string(), 300),
            ("security".to_string(), 200),
        ]),
        by_severity: HashMap::from([
            ("info".to_string(), 600),
            ("warning".to_string(), 300),
            ("critical".to_string(), 100),
        ]),
        by_action: HashMap::from([
            ("create".to_string(), 400),
            ("update".to_string(), 300),
            ("delete".to_string(), 200),
            ("read".to_string(), 100),
        ]),
        oldest_entry: Some("2024-01-01T00:00:00Z".to_string()),
        newest_entry: Some("2024-12-31T23:59:59Z".to_string()),
        entries_last_24h: 150,
    }
}

// ── AuditEventType Tests ────────────────────────────────────────────────────

#[test]
fn test_audit_event_type_contract_display() {
    let event_type = AuditEventType::Contract;
    assert_eq!(format!("{}", event_type), "contract");
}

#[test]
fn test_audit_event_type_admin_display() {
    let event_type = AuditEventType::Admin;
    assert_eq!(format!("{}", event_type), "admin");
}

#[test]
fn test_audit_event_type_system_display() {
    let event_type = AuditEventType::System;
    assert_eq!(format!("{}", event_type), "system");
}

#[test]
fn test_audit_event_type_security_display() {
    let event_type = AuditEventType::Security;
    assert_eq!(format!("{}", event_type), "security");
}

#[test]
fn test_audit_event_type_export_display() {
    let event_type = AuditEventType::Export;
    assert_eq!(format!("{}", event_type), "export");
}

#[test]
fn test_audit_event_type_equality() {
    let event_type1 = AuditEventType::Contract;
    let event_type2 = AuditEventType::Contract;
    assert_eq!(event_type1, event_type2);
}

#[test]
fn test_audit_event_type_inequality() {
    let event_type1 = AuditEventType::Contract;
    let event_type2 = AuditEventType::Admin;
    assert_ne!(event_type1, event_type2);
}

#[test]
fn test_audit_event_type_clone() {
    let event_type1 = AuditEventType::Contract;
    let event_type2 = event_type1.clone();
    assert_eq!(event_type1, event_type2);
}

// ── AuditAction Tests ───────────────────────────────────────────────────────

#[test]
fn test_audit_action_create_display() {
    let action = AuditAction::Create;
    assert_eq!(format!("{}", action), "create");
}

#[test]
fn test_audit_action_update_display() {
    let action = AuditAction::Update;
    assert_eq!(format!("{}", action), "update");
}

#[test]
fn test_audit_action_delete_display() {
    let action = AuditAction::Delete;
    assert_eq!(format!("{}", action), "delete");
}

#[test]
fn test_audit_action_read_display() {
    let action = AuditAction::Read;
    assert_eq!(format!("{}", action), "read");
}

#[test]
fn test_audit_action_approve_display() {
    let action = AuditAction::Approve;
    assert_eq!(format!("{}", action), "approve");
}

#[test]
fn test_audit_action_reject_display() {
    let action = AuditAction::Reject;
    assert_eq!(format!("{}", action), "reject");
}

#[test]
fn test_audit_action_login_display() {
    let action = AuditAction::Login;
    assert_eq!(format!("{}", action), "login");
}

#[test]
fn test_audit_action_logout_display() {
    let action = AuditAction::Logout;
    assert_eq!(format!("{}", action), "logout");
}

#[test]
fn test_audit_action_export_display() {
    let action = AuditAction::Export;
    assert_eq!(format!("{}", action), "export");
}

#[test]
fn test_audit_action_equality() {
    let action1 = AuditAction::Create;
    let action2 = AuditAction::Create;
    assert_eq!(action1, action2);
}

// ── AuditEntry Tests ────────────────────────────────────────────────────────

#[test]
fn test_audit_entry_valid_structure() {
    let entry = valid_audit_entry();

    assert!(!entry.id.is_empty());
    assert!(!entry.event_type.is_empty());
    assert!(!entry.action.is_empty());
    assert!(!entry.user_id.is_empty());
}

#[test]
fn test_audit_entry_with_resource_id() {
    let entry = valid_audit_entry();

    assert!(entry.resource_id.is_some());
    assert_eq!(entry.resource_id, Some("res_001".to_string()));
}

#[test]
fn test_audit_entry_without_resource_id() {
    let mut entry = valid_audit_entry();
    entry.resource_id = None;

    assert!(entry.resource_id.is_none());
}

#[test]
fn test_audit_entry_with_user_agent() {
    let entry = valid_audit_entry();

    assert!(entry.user_agent.is_some());
    assert_eq!(entry.user_agent, Some("Mozilla/5.0".to_string()));
}

#[test]
fn test_audit_entry_without_user_agent() {
    let mut entry = valid_audit_entry();
    entry.user_agent = None;

    assert!(entry.user_agent.is_none());
}

#[test]
fn test_audit_entry_with_changes() {
    let mut entry = valid_audit_entry();
    let mut changes = HashMap::new();
    changes.insert("status".to_string(), serde_json::json!("approved"));
    entry.changes = Some(changes);

    assert!(entry.changes.is_some());
}

#[test]
fn test_audit_entry_severity_levels() {
    let severity_levels = vec!["info", "warning", "error", "critical"];

    for severity in severity_levels {
        let mut entry = valid_audit_entry();
        entry.severity = severity.to_string();
        assert_eq!(entry.severity, severity);
    }
}

#[test]
fn test_audit_entry_timestamp_validity() {
    let entry = valid_audit_entry();
    let now = Utc::now();

    // Timestamp should be recent
    assert!(now.signed_duration_since(entry.timestamp).num_seconds() >= 0);
}

#[test]
fn test_audit_entry_ip_address_variations() {
    let ip_addresses = vec![
        "192.168.1.1",
        "10.0.0.1",
        "127.0.0.1",
        "::1",
        "2001:db8::1",
    ];

    for ip in ip_addresses {
        let mut entry = valid_audit_entry();
        entry.ip_address = ip.to_string();
        assert_eq!(entry.ip_address, ip);
    }
}

#[test]
fn test_audit_entry_serialization() {
    let entry = valid_audit_entry();
    let json = serde_json::to_string(&entry).expect("serialization should work");
    let deserialized: AuditEntry = serde_json::from_str(&json)
        .expect("deserialization should work");

    assert_eq!(entry.id, deserialized.id);
    assert_eq!(entry.event_type, deserialized.event_type);
    assert_eq!(entry.action, deserialized.action);
}

#[test]
fn test_audit_entry_clone() {
    let entry = valid_audit_entry();
    let cloned = entry.clone();

    assert_eq!(entry.id, cloned.id);
    assert_eq!(entry.event_type, cloned.event_type);
}

// ── AuditQuery Tests ────────────────────────────────────────────────────────

#[test]
fn test_audit_query_all_none() {
    let query = valid_audit_query();

    assert!(query.event_type.is_none());
    assert!(query.user_id.is_none());
    assert!(query.action.is_none());
}

#[test]
fn test_audit_query_with_event_type_filter() {
    let mut query = valid_audit_query();
    query.event_type = Some(AuditEventType::Contract);

    assert!(query.event_type.is_some());
}

#[test]
fn test_audit_query_with_user_id_filter() {
    let mut query = valid_audit_query();
    query.user_id = Some("user_123".to_string());

    assert_eq!(query.user_id, Some("user_123".to_string()));
}

#[test]
fn test_audit_query_with_action_filter() {
    let mut query = valid_audit_query();
    query.action = Some(AuditAction::Create);

    assert!(query.action.is_some());
}

#[test]
fn test_audit_query_with_date_range() {
    let mut query = valid_audit_query();
    let start = Utc::now();
    let end = Utc::now();
    query.start_date = Some(start);
    query.end_date = Some(end);

    assert!(query.start_date.is_some());
    assert!(query.end_date.is_some());
}

#[test]
fn test_audit_query_with_severity_filter() {
    let mut query = valid_audit_query();
    query.severity = Some("critical".to_string());

    assert_eq!(query.severity, Some("critical".to_string()));
}

#[test]
fn test_audit_query_pagination_offset() {
    let mut query = valid_audit_query();
    query.limit = Some(50);
    query.offset = Some(100);

    assert_eq!(query.limit, Some(50));
    assert_eq!(query.offset, Some(100));
}

#[test]
fn test_audit_query_clone() {
    let query = valid_audit_query();
    let cloned = query.clone();

    assert_eq!(query.limit, cloned.limit);
    assert_eq!(query.offset, cloned.offset);
}

// ── AuditSummary Tests ──────────────────────────────────────────────────────

#[test]
fn test_audit_summary_valid_structure() {
    let summary = valid_audit_summary();

    assert!(summary.total_entries > 0);
    assert!(!summary.by_event_type.is_empty());
    assert!(!summary.by_severity.is_empty());
}

#[test]
fn test_audit_summary_aggregations() {
    let summary = valid_audit_summary();

    let total_by_type: u64 = summary.by_event_type.values().sum();
    assert_eq!(total_by_type, 1000);
}

#[test]
fn test_audit_summary_date_range() {
    let summary = valid_audit_summary();

    assert!(summary.oldest_entry.is_some());
    assert!(summary.newest_entry.is_some());
}

#[test]
fn test_audit_summary_last_24h_entries() {
    let summary = valid_audit_summary();

    assert!(summary.entries_last_24h < summary.total_entries);
}

#[test]
fn test_audit_summary_empty_aggregations() {
    let summary = AuditSummary {
        total_entries: 0,
        by_event_type: HashMap::new(),
        by_severity: HashMap::new(),
        by_action: HashMap::new(),
        oldest_entry: None,
        newest_entry: None,
        entries_last_24h: 0,
    };

    assert_eq!(summary.total_entries, 0);
    assert!(summary.by_event_type.is_empty());
}

#[test]
fn test_audit_summary_serialization() {
    let summary = valid_audit_summary();
    let json = serde_json::to_string(&summary).expect("serialization should work");
    let deserialized: AuditSummary = serde_json::from_str(&json)
        .expect("deserialization should work");

    assert_eq!(summary.total_entries, deserialized.total_entries);
    assert_eq!(summary.by_event_type, deserialized.by_event_type);
}

#[test]
fn test_audit_summary_clone() {
    let summary = valid_audit_summary();
    let cloned = summary.clone();

    assert_eq!(summary.total_entries, cloned.total_entries);
}

// ── AuditReport Tests ───────────────────────────────────────────────────────

#[test]
fn test_audit_report_valid_structure() {
    let report = AuditReport {
        generated_at: Utc::now().to_rfc3339(),
        period_start: "2024-01-01T00:00:00Z".to_string(),
        period_end: "2024-12-31T23:59:59Z".to_string(),
        summary: valid_audit_summary(),
        top_users: vec!["user_001".to_string(), "user_002".to_string()],
        recent_entries: vec![],
        export_format: Some("json".to_string()),
    };

    assert!(!report.generated_at.is_empty());
    assert!(!report.period_start.is_empty());
}

#[test]
fn test_audit_report_serialization() {
    let report = AuditReport {
        generated_at: Utc::now().to_rfc3339(),
        period_start: "2024-01-01T00:00:00Z".to_string(),
        period_end: "2024-12-31T23:59:59Z".to_string(),
        summary: valid_audit_summary(),
        top_users: vec![],
        recent_entries: vec![],
        export_format: None,
    };

    let json = serde_json::to_string(&report).expect("serialization should work");
    let _deserialized: AuditReport = serde_json::from_str(&json)
        .expect("deserialization should work");
}

// ── Integration tests combining multiple types ──────────────────────────────

#[test]
fn test_audit_entry_to_query_roundtrip() {
    let entry = valid_audit_entry();
    let mut query = valid_audit_query();
    query.user_id = Some(entry.user_id.clone());

    assert_eq!(query.user_id, Some(entry.user_id));
}

#[test]
fn test_multiple_event_types_in_summary() {
    let event_types = vec![
        AuditEventType::Contract,
        AuditEventType::Admin,
        AuditEventType::System,
        AuditEventType::Security,
        AuditEventType::Export,
    ];

    for event_type in event_types {
        assert!(!format!("{}", event_type).is_empty());
    }
}

#[test]
fn test_all_audit_actions_enumerated() {
    let actions = vec![
        AuditAction::Create,
        AuditAction::Update,
        AuditAction::Delete,
        AuditAction::Read,
        AuditAction::Approve,
        AuditAction::Reject,
        AuditAction::Login,
        AuditAction::Logout,
        AuditAction::Export,
    ];

    assert_eq!(actions.len(), 9);
    for action in actions {
        assert!(!format!("{}", action).is_empty());
    }
}

#[test]
fn test_audit_entry_with_complete_changes() {
    let mut entry = valid_audit_entry();
    let mut changes = HashMap::new();
    changes.insert("field1".to_string(), serde_json::json!("old_value"));
    changes.insert("field2".to_string(), serde_json::json!(42));
    changes.insert("field3".to_string(), serde_json::json!(true));
    entry.changes = Some(changes);

    assert!(entry.changes.is_some());
    let changes_ref = entry.changes.unwrap();
    assert_eq!(changes_ref.len(), 3);
}

#[test]
fn test_audit_query_complex_filter_combination() {
    let mut query = valid_audit_query();
    query.event_type = Some(AuditEventType::Security);
    query.action = Some(AuditAction::Delete);
    query.severity = Some("critical".to_string());
    query.user_id = Some("admin_001".to_string());

    assert!(query.event_type.is_some());
    assert!(query.action.is_some());
    assert!(query.severity.is_some());
    assert!(query.user_id.is_some());
}

#[test]
fn test_audit_entry_empty_strings() {
    let entry = AuditEntry {
        id: String::new(),
        event_type: String::new(),
        action: String::new(),
        user_id: String::new(),
        resource_type: String::new(),
        resource_id: None,
        details: String::new(),
        timestamp: Utc::now(),
        ip_address: String::new(),
        user_agent: None,
        severity: String::new(),
        changes: None,
    };

    assert!(entry.id.is_empty());
    assert!(entry.event_type.is_empty());
}

#[test]
fn test_audit_summary_with_single_entry() {
    let summary = AuditSummary {
        total_entries: 1,
        by_event_type: HashMap::from([("contract".to_string(), 1)]),
        by_severity: HashMap::from([("info".to_string(), 1)]),
        by_action: HashMap::from([("create".to_string(), 1)]),
        oldest_entry: Some("2024-01-01T00:00:00Z".to_string()),
        newest_entry: Some("2024-01-01T00:00:00Z".to_string()),
        entries_last_24h: 1,
    };

    assert_eq!(summary.total_entries, 1);
}
