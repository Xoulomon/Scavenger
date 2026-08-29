use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceAuditEntry {
    pub id: String,
    pub compliance_id: String,
    pub action: String,
    pub actor: String,
    pub details: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub metadata: std::collections::HashMap<String, String>,
}

pub struct ComplianceAuditTrail {
    entries: Mutex<Vec<ComplianceAuditEntry>>,
}

impl ComplianceAuditTrail {
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(Vec::new()),
        }
    }

    pub fn record(&self, compliance_id: &str, action: &str, actor: &str, details: &str) {
        let entry = ComplianceAuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            compliance_id: compliance_id.to_string(),
            action: action.to_string(),
            actor: actor.to_string(),
            details: details.to_string(),
            timestamp: Utc::now(),
            metadata: std::collections::HashMap::new(),
        };
        self.entries.lock().unwrap().push(entry);
    }

    pub fn get_entries(&self, limit: usize) -> Vec<ComplianceAuditEntry> {
        let entries = self.entries.lock().unwrap();
        entries.iter().rev().take(limit).cloned().collect()
    }

    pub fn get_entries_for_compliance(&self, compliance_id: &str) -> Vec<ComplianceAuditEntry> {
        let entries = self.entries.lock().unwrap();
        entries
            .iter()
            .filter(|e| e.compliance_id == compliance_id)
            .cloned()
            .collect()
    }

    pub fn count(&self) -> usize {
        self.entries.lock().unwrap().len()
    }
}

impl Default for ComplianceAuditTrail {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_trail_has_no_entries() {
        let trail = ComplianceAuditTrail::new();
        assert_eq!(trail.count(), 0);
        assert!(trail.get_entries(10).is_empty());
    }

    #[test]
    fn default_trail_has_no_entries() {
        let trail = ComplianceAuditTrail::default();
        assert_eq!(trail.count(), 0);
    }

    #[test]
    fn record_adds_entry() {
        let trail = ComplianceAuditTrail::new();
        trail.record("comp-1", "submit", "alice", "Submitted compliance report");
        assert_eq!(trail.count(), 1);
    }

    #[test]
    fn record_stores_correct_fields() {
        let trail = ComplianceAuditTrail::new();
        trail.record("comp-42", "approve", "bob", "Approved by admin");

        let entries = trail.get_entries(10);
        assert_eq!(entries.len(), 1);
        let entry = &entries[0];
        assert_eq!(entry.compliance_id, "comp-42");
        assert_eq!(entry.action, "approve");
        assert_eq!(entry.actor, "bob");
        assert_eq!(entry.details, "Approved by admin");
        assert!(!entry.id.is_empty());
        // Metadata starts empty
        assert!(entry.metadata.is_empty());
    }

    #[test]
    fn record_generates_unique_ids() {
        let trail = ComplianceAuditTrail::new();
        trail.record("c1", "a1", "actor1", "d1");
        trail.record("c2", "a2", "actor2", "d2");

        let entries = trail.get_entries(10);
        assert_ne!(entries[0].id, entries[1].id);
    }

    #[test]
    fn record_sets_timestamp() {
        let before = Utc::now();
        let trail = ComplianceAuditTrail::new();
        trail.record("c1", "a1", "actor1", "d1");
        let after = Utc::now();

        let entries = trail.get_entries(10);
        let ts = entries[0].timestamp;
        assert!(ts >= before && ts <= after);
    }

    #[test]
    fn get_entries_returns_most_recent_first() {
        let trail = ComplianceAuditTrail::new();
        trail.record("c1", "first", "actor", "d1");
        trail.record("c2", "second", "actor", "d2");
        trail.record("c3", "third", "actor", "d3");

        let entries = trail.get_entries(10);
        assert_eq!(entries.len(), 3);
        // Most recent first
        assert_eq!(entries[0].action, "third");
        assert_eq!(entries[1].action, "second");
        assert_eq!(entries[2].action, "first");
    }

    #[test]
    fn get_entries_respects_limit() {
        let trail = ComplianceAuditTrail::new();
        for i in 0..20 {
            trail.record(&format!("c{}", i), "action", "actor", "details");
        }

        let entries = trail.get_entries(5);
        assert_eq!(entries.len(), 5);
        // Should be the 5 most recent
        assert_eq!(entries[0].compliance_id, "c19");
    }

    #[test]
    fn get_entries_limit_zero_returns_empty() {
        let trail = ComplianceAuditTrail::new();
        trail.record("c1", "a", "actor", "d");
        assert!(trail.get_entries(0).is_empty());
    }

    #[test]
    fn get_entries_limit_exceeds_count_returns_all() {
        let trail = ComplianceAuditTrail::new();
        trail.record("c1", "a", "actor", "d");
        trail.record("c2", "a", "actor", "d");

        let entries = trail.get_entries(100);
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn get_entries_for_compliance_filters_correctly() {
        let trail = ComplianceAuditTrail::new();
        trail.record("c1", "a1", "actor", "d1");
        trail.record("c2", "a2", "actor", "d2");
        trail.record("c1", "a3", "actor", "d3");
        trail.record("c3", "a4", "actor", "d4");
        trail.record("c2", "a5", "actor", "d5");

        let c1_entries = trail.get_entries_for_compliance("c1");
        assert_eq!(c1_entries.len(), 2);
        assert!(c1_entries.iter().all(|e| e.compliance_id == "c1"));

        let c2_entries = trail.get_entries_for_compliance("c2");
        assert_eq!(c2_entries.len(), 2);

        let c4_entries = trail.get_entries_for_compliance("c4");
        assert!(c4_entries.is_empty());
    }

    #[test]
    fn count_increases_correctly() {
        let trail = ComplianceAuditTrail::new();
        assert_eq!(trail.count(), 0);
        trail.record("c1", "a", "actor", "d");
        assert_eq!(trail.count(), 1);
        trail.record("c2", "a", "actor", "d");
        assert_eq!(trail.count(), 2);
    }

    #[test]
    fn entries_are_independent_clones() {
        let trail = ComplianceAuditTrail::new();
        trail.record("c1", "a1", "actor", "d1");

        let entries1 = trail.get_entries(10);
        trail.record("c2", "a2", "actor", "d2");
        let entries2 = trail.get_entries(10);

        // entries1 should still have only 1 entry (snapshot before c2)
        assert_eq!(entries1.len(), 1);
        assert_eq!(entries2.len(), 2);
    }
}
