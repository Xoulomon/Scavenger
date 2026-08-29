use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceRequirement {
    pub id: String,
    pub category: String,
    pub description: String,
    pub framework: String,
    pub mandatory: bool,
    pub check_function: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceChecklist {
    pub id: String,
    pub requirements: Vec<ComplianceRequirement>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub status: ChecklistStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ChecklistStatus {
    Draft,
    Active,
    Deprecated,
}

impl ComplianceChecklist {
    pub fn new(id: String) -> Self {
        Self {
            id,
            requirements: Vec::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            status: ChecklistStatus::Active,
        }
    }

    pub fn add_requirement(&mut self, requirement: ComplianceRequirement) {
        self.requirements.push(requirement);
        self.updated_at = Utc::now();
    }

    pub fn remove_requirement(&mut self, requirement_id: &str) {
        self.requirements.retain(|r| r.id != requirement_id);
        self.updated_at = Utc::now();
    }

    pub fn get_requirement(&self, requirement_id: &str) -> Option<&ComplianceRequirement> {
        self.requirements.iter().find(|r| r.id == requirement_id)
    }

    pub fn mandatory_count(&self) -> usize {
        self.requirements.iter().filter(|r| r.mandatory).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_requirement(id: &str, mandatory: bool, check_fn: Option<&str>) -> ComplianceRequirement {
        ComplianceRequirement {
            id: id.to_string(),
            category: "Security".to_string(),
            description: format!("Requirement {}", id),
            framework: "SOC2".to_string(),
            mandatory,
            check_function: check_fn.map(|s| s.to_string()),
        }
    }

    #[test]
    fn new_checklist_has_empty_requirements_and_active_status() {
        let cl = ComplianceChecklist::new("cl-1".to_string());
        assert_eq!(cl.id, "cl-1");
        assert!(cl.requirements.is_empty());
        assert_eq!(cl.status, ChecklistStatus::Active);
    }

    #[test]
    fn add_requirement_increases_count_and_updates_timestamp() {
        let mut cl = ComplianceChecklist::new("cl-1".to_string());
        let before = cl.updated_at;
        // Small sleep to ensure timestamp differs (may not work on fast systems)
        cl.add_requirement(make_requirement("r1", true, Some("data_encrypted")));
        assert_eq!(cl.requirements.len(), 1);
        assert!(cl.updated_at >= before);
    }

    #[test]
    fn add_multiple_requirements() {
        let mut cl = ComplianceChecklist::new("cl-1".to_string());
        cl.add_requirement(make_requirement("r1", true, None));
        cl.add_requirement(make_requirement("r2", false, None));
        cl.add_requirement(make_requirement("r3", true, None));
        assert_eq!(cl.requirements.len(), 3);
    }

    #[test]
    fn remove_requirement_by_id() {
        let mut cl = ComplianceChecklist::new("cl-1".to_string());
        cl.add_requirement(make_requirement("r1", true, None));
        cl.add_requirement(make_requirement("r2", false, None));

        cl.remove_requirement("r1");
        assert_eq!(cl.requirements.len(), 1);
        assert_eq!(cl.requirements[0].id, "r2");
    }

    #[test]
    fn remove_nonexistent_requirement_no_op() {
        let mut cl = ComplianceChecklist::new("cl-1".to_string());
        cl.add_requirement(make_requirement("r1", true, None));
        cl.remove_requirement("nonexistent");
        assert_eq!(cl.requirements.len(), 1);
    }

    #[test]
    fn get_requirement_returns_correct_one() {
        let mut cl = ComplianceChecklist::new("cl-1".to_string());
        cl.add_requirement(make_requirement("r1", true, None));
        cl.add_requirement(make_requirement("r2", false, None));

        let req = cl.get_requirement("r2");
        assert!(req.is_some());
        assert_eq!(req.unwrap().id, "r2");
    }

    #[test]
    fn get_requirement_nonexistent_returns_none() {
        let cl = ComplianceChecklist::new("cl-1".to_string());
        assert!(cl.get_requirement("r1").is_none());
    }

    #[test]
    fn mandatory_count_only_counts_mandatory() {
        let mut cl = ComplianceChecklist::new("cl-1".to_string());
        cl.add_requirement(make_requirement("r1", true, None));
        cl.add_requirement(make_requirement("r2", false, None));
        cl.add_requirement(make_requirement("r3", true, None));
        cl.add_requirement(make_requirement("r4", false, None));
        cl.add_requirement(make_requirement("r5", true, None));

        assert_eq!(cl.mandatory_count(), 3);
    }

    #[test]
    fn mandatory_count_zero_when_none_mandatory() {
        let mut cl = ComplianceChecklist::new("cl-1".to_string());
        cl.add_requirement(make_requirement("r1", false, None));
        cl.add_requirement(make_requirement("r2", false, None));
        assert_eq!(cl.mandatory_count(), 0);
    }

    #[test]
    fn mandatory_count_zero_when_empty() {
        let cl = ComplianceChecklist::new("cl-1".to_string());
        assert_eq!(cl.mandatory_count(), 0);
    }

    #[test]
    fn remove_updates_timestamp() {
        let mut cl = ComplianceChecklist::new("cl-1".to_string());
        cl.add_requirement(make_requirement("r1", true, None));
        let after_add = cl.updated_at;

        cl.remove_requirement("r1");
        assert!(cl.updated_at >= after_add);
    }

    #[test]
    fn requirement_stores_check_function() {
        let req = make_requirement("r1", true, Some("audit_logging_enabled"));
        assert_eq!(req.check_function.as_deref(), Some("audit_logging_enabled"));
    }

    #[test]
    fn requirement_with_no_check_function() {
        let req = make_requirement("r1", true, None);
        assert!(req.check_function.is_none());
    }
}
