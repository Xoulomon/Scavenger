use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceAlert {
    pub id: String,
    pub rule_id: String,
    pub severity: AlertSeverity,
    pub status: AlertStatus,
    pub message: String,
    pub details: serde_json::Value,
    pub triggered_at: chrono::DateTime<chrono::Utc>,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub severity: AlertSeverity,
    pub condition: AlertCondition,
    pub enabled: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertCondition {
    pub metric: String,
    pub operator: String,
    pub threshold: f64,
    pub window_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AlertSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AlertStatus {
    Open,
    Acknowledged,
    Resolved,
    Suppressed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertChannel {
    pub name: String,
    pub channel_type: String,
    pub destination: String,
    pub enabled: bool,
}

pub struct ComplianceAlertingService {
    alerts: Vec<ComplianceAlert>,
    rules: Vec<AlertRule>,
    channels: Vec<AlertChannel>,
}

impl ComplianceAlertingService {
    pub fn new() -> Self {
        Self {
            alerts: Vec::new(),
            rules: Vec::new(),
            channels: Vec::new(),
        }
    }

    pub fn add_rule(&mut self, rule: AlertRule) {
        self.rules.push(rule);
    }

    pub fn evaluate(&mut self, metric_name: &str, value: f64) -> Option<ComplianceAlert> {
        for rule in &self.rules {
            if !rule.enabled {
                continue;
            }
            if rule.condition.metric == metric_name {
                let triggered = match rule.condition.operator.as_str() {
                    ">" => value > rule.condition.threshold,
                    "<" => value < rule.condition.threshold,
                    ">=" => value >= rule.condition.threshold,
                    "<=" => value <= rule.condition.threshold,
                    "==" => value == rule.condition.threshold,
                    _ => false,
                };
                if triggered {
                    let alert = ComplianceAlert {
                        id: uuid::Uuid::new_v4().to_string(),
                        rule_id: rule.id.clone(),
                        severity: rule.severity.clone(),
                        status: AlertStatus::Open,
                        message: format!("{} triggered: {} {}", rule.name, metric_name, value),
                        details: serde_json::json!({"value": value, "threshold": rule.condition.threshold}),
                        triggered_at: Utc::now(),
                        resolved_at: None,
                    };
                    self.alerts.push(alert.clone());
                    return Some(alert);
                }
            }
        }
        None
    }

    pub fn add_channel(&mut self, channel: AlertChannel) {
        self.channels.push(channel);
    }

    pub fn get_active_alerts(&self) -> Vec<&ComplianceAlert> {
        self.alerts.iter().filter(|a| a.status == AlertStatus::Open).collect()
    }

    pub fn acknowledge_alert(&mut self, alert_id: &str) -> Option<()> {
        if let Some(alert) = self.alerts.iter_mut().find(|a| a.id == alert_id) {
            alert.status = AlertStatus::Acknowledged;
            Some(())
        } else {
            None
        }
    }

    pub fn resolve_alert(&mut self, alert_id: &str) -> Option<()> {
        if let Some(alert) = self.alerts.iter_mut().find(|a| a.id == alert_id) {
            alert.status = AlertStatus::Resolved;
            alert.resolved_at = Some(Utc::now());
            Some(())
        } else {
            None
        }
    }

    pub fn get_rules(&self) -> &Vec<AlertRule> {
        &self.rules
    }

    pub fn get_channels(&self) -> &Vec<AlertChannel> {
        &self.channels
    }
}

impl Default for ComplianceAlertingService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_rule(
        id: &str,
        metric: &str,
        operator: &str,
        threshold: f64,
        severity: AlertSeverity,
        enabled: bool,
    ) -> AlertRule {
        AlertRule {
            id: id.to_string(),
            name: format!("Rule {}", id),
            description: format!("Test rule {}", id),
            severity,
            condition: AlertCondition {
                metric: metric.to_string(),
                operator: operator.to_string(),
                threshold,
                window_seconds: 3600,
            },
            enabled,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn default_service_has_no_rules_alerts_channels() {
        let svc = ComplianceAlertingService::default();
        assert!(svc.get_rules().is_empty());
        assert!(svc.get_active_alerts().is_empty());
        assert!(svc.get_channels().is_empty());
    }

    #[test]
    fn add_rule_increases_rule_count() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "error_rate", ">", 0.1, AlertSeverity::High, true));
        assert_eq!(svc.get_rules().len(), 1);
        assert_eq!(svc.get_rules()[0].id, "r1");
    }

    #[test]
    fn evaluate_triggers_on_greater_than() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "error_rate", ">", 0.05, AlertSeverity::Critical, true));

        // 0.10 > 0.05 => triggered
        let alert = svc.evaluate("error_rate", 0.10);
        assert!(alert.is_some());
        let alert = alert.unwrap();
        assert_eq!(alert.severity, AlertSeverity::Critical);
        assert_eq!(alert.status, AlertStatus::Open);
        assert!(alert.message.contains("error_rate"));
        assert_eq!(alert.details["value"], 0.10);
        assert_eq!(alert.details["threshold"], 0.05);
    }

    #[test]
    fn evaluate_no_trigger_when_value_below_threshold() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "error_rate", ">", 0.05, AlertSeverity::Critical, true));

        // 0.01 <= 0.05 => not triggered
        assert!(svc.evaluate("error_rate", 0.01).is_none());
        assert!(svc.get_active_alerts().is_empty());
    }

    #[test]
    fn evaluate_boundary_threshold_minus_one() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "latency", ">", 100.0, AlertSeverity::Medium, true));

        // 99.9 is NOT > 100 => no trigger
        assert!(svc.evaluate("latency", 99.9).is_none());
    }

    #[test]
    fn evaluate_boundary_at_threshold() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "latency", ">=", 100.0, AlertSeverity::Medium, true));

        // 100.0 >= 100.0 => triggered
        let alert = svc.evaluate("latency", 100.0);
        assert!(alert.is_some());
    }

    #[test]
    fn evaluate_boundary_threshold_plus_one() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "latency", ">", 100.0, AlertSeverity::Medium, true));

        // 100.1 > 100 => triggered
        assert!(svc.evaluate("latency", 100.1).is_some());
    }

    #[test]
    fn evaluate_less_than_operator() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "uptime", "<", 99.0, AlertSeverity::High, true));

        assert!(svc.evaluate("uptime", 98.5).is_some());
        assert!(svc.evaluate("uptime", 99.0).is_none());
        assert!(svc.evaluate("uptime", 99.5).is_none());
    }

    #[test]
    fn evaluate_less_than_or_equal_operator() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "score", "<=", 50.0, AlertSeverity::Low, true));

        assert!(svc.evaluate("score", 49.0).is_some());
        assert!(svc.evaluate("score", 50.0).is_some());
        assert!(svc.evaluate("score", 51.0).is_none());
    }

    #[test]
    fn evaluate_greater_than_or_equal_operator() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "count", ">=", 1000.0, AlertSeverity::Info, true));

        assert!(svc.evaluate("count", 999.0).is_none());
        assert!(svc.evaluate("count", 1000.0).is_some());
        assert!(svc.evaluate("count", 1001.0).is_some());
    }

    #[test]
    fn evaluate_equality_operator() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "status_code", "==", 500.0, AlertSeverity::Critical, true));

        assert!(svc.evaluate("status_code", 500.0).is_some());
        assert!(svc.evaluate("status_code", 499.0).is_none());
        assert!(svc.evaluate("status_code", 200.0).is_none());
    }

    #[test]
    fn evaluate_unknown_operator_returns_none() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "metric", "!=", 10.0, AlertSeverity::Medium, true));

        // "!=" is not a recognized operator
        assert!(svc.evaluate("metric", 20.0).is_none());
    }

    #[test]
    fn evaluate_wrong_metric_returns_none() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "error_rate", ">", 0.05, AlertSeverity::High, true));

        assert!(svc.evaluate("latency", 100.0).is_none());
    }

    #[test]
    fn evaluate_disabled_rule_not_triggered() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "error_rate", ">", 0.05, AlertSeverity::Critical, false));

        assert!(svc.evaluate("error_rate", 1.0).is_none());
        assert!(svc.get_active_alerts().is_empty());
    }

    #[test]
    fn evaluate_no_rules_returns_none() {
        let mut svc = ComplianceAlertingService::new();
        assert!(svc.evaluate("anything", 42.0).is_none());
    }

    #[test]
    fn alert_id_is_unique_uuid() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "m", ">", 0.0, AlertSeverity::Info, true));

        let a1 = svc.evaluate("m", 1.0).unwrap();
        let a2 = svc.evaluate("m", 2.0).unwrap();
        assert_ne!(a1.id, a2.id);
        // UUID v4 format: 8-4-4-4-12
        assert_eq!(a1.id.len(), 36);
        assert_eq!(a1.id.chars().filter(|c| *c == '-').count(), 4);
    }

    #[test]
    fn alert_has_correct_rule_id_and_severity() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("rule-42", "cpu", ">", 90.0, AlertSeverity::High, true));

        let alert = svc.evaluate("cpu", 95.0).unwrap();
        assert_eq!(alert.rule_id, "rule-42");
        assert_eq!(alert.severity, AlertSeverity::High);
        assert_eq!(alert.status, AlertStatus::Open);
        assert!(alert.resolved_at.is_none());
    }

    #[test]
    fn get_active_alerts_returns_only_open() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "m", ">", 0.0, AlertSeverity::Info, true));

        let a1 = svc.evaluate("m", 1.0).unwrap();
        let a2 = svc.evaluate("m", 2.0).unwrap();
        let a3 = svc.evaluate("m", 3.0).unwrap();

        svc.acknowledge_alert(&a2.id);
        svc.resolve_alert(&a3.id);

        let active = svc.get_active_alerts();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, a1.id);
    }

    #[test]
    fn acknowledge_alert_transitions_status() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "m", ">", 0.0, AlertSeverity::Info, true));
        let alert = svc.evaluate("m", 1.0).unwrap();

        assert_eq!(svc.acknowledge_alert(&alert.id), Some(()));
        // Alert is now acknowledged, not active
        assert!(svc.get_active_alerts().is_empty());
    }

    #[test]
    fn acknowledge_nonexistent_alert_returns_none() {
        let mut svc = ComplianceAlertingService::new();
        assert_eq!(svc.acknowledge_alert("nonexistent"), None);
    }

    #[test]
    fn resolve_alert_sets_resolved_at_and_status() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "m", ">", 0.0, AlertSeverity::Info, true));
        let alert = svc.evaluate("m", 1.0).unwrap();

        assert_eq!(svc.resolve_alert(&alert.id), Some(()));
        // Alert should no longer be active
        assert!(svc.get_active_alerts().is_empty());
    }

    #[test]
    fn resolve_nonexistent_alert_returns_none() {
        let mut svc = ComplianceAlertingService::new();
        assert_eq!(svc.resolve_alert("nonexistent"), None);
    }

    #[test]
    fn multiple_rules_same_metric_first_enabled_triggers() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "m", ">", 10.0, AlertSeverity::Low, true));
        svc.add_rule(make_rule("r2", "m", ">", 5.0, AlertSeverity::High, true));

        // 12.0 > 10.0 => first matching rule triggers (r1)
        let alert = svc.evaluate("m", 12.0).unwrap();
        assert_eq!(alert.rule_id, "r1");
        assert_eq!(alert.severity, AlertSeverity::Low);
    }

    #[test]
    fn multiple_rules_first_disabled_second_triggers() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "m", ">", 10.0, AlertSeverity::Low, false));
        svc.add_rule(make_rule("r2", "m", ">", 5.0, AlertSeverity::High, true));

        // r1 is disabled, so r2 should trigger
        let alert = svc.evaluate("m", 12.0).unwrap();
        assert_eq!(alert.rule_id, "r2");
    }

    #[test]
    fn add_channel_and_get_channels() {
        let mut svc = ComplianceAlertingService::new();
        let ch = AlertChannel {
            name: "Slack".to_string(),
            channel_type: "webhook".to_string(),
            destination: "https://hooks.slack.com/test".to_string(),
            enabled: true,
        };
        svc.add_channel(ch);
        assert_eq!(svc.get_channels().len(), 1);
        assert_eq!(svc.get_channels()[0].name, "Slack");
    }

    #[test]
    fn evaluate_stores_alert_in_service() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "m", ">", 0.0, AlertSeverity::Info, true));

        svc.evaluate("m", 1.0);
        svc.evaluate("m", 2.0);
        svc.evaluate("m", 3.0);

        // All 3 alerts stored, all active
        assert_eq!(svc.get_active_alerts().len(), 3);
    }

    #[test]
    fn details_json_contains_expected_fields() {
        let mut svc = ComplianceAlertingService::new();
        svc.add_rule(make_rule("r1", "error_rate", ">", 0.05, AlertSeverity::High, true));

        let alert = svc.evaluate("error_rate", 0.42).unwrap();
        assert_eq!(alert.details["value"], 0.42);
        assert_eq!(alert.details["threshold"], 0.05);
    }
}
