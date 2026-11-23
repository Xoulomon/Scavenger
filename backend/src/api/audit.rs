//! HTTP handlers for audit endpoints. Business logic lives in `services/audit.rs` and data access
//! in `repositories/audit.rs`; these handlers only parse the request, call the audit service and
//! serialise the response.

use actix_web::{web, HttpResponse};
use chrono::DateTime;

use crate::services::api::ApiBuilder;
use crate::services::audit::{AlertRule, AuditAction, AuditEventType, AuditQuery, AuditService, RetentionPolicy};
use crate::validation::{error_response, validate_pagination};

#[derive(Debug, Deserialize)]
pub struct AuditLogQueryParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub event_type: Option<String>,
    pub user_id: Option<String>,
    pub action: Option<String>,
    pub resource_type: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub severity: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuditReportRequest {
    pub start_date: String,
    pub end_date: String,
    pub event_types: Option<Vec<String>>,
    pub group_by: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AlertRuleRequest {
    pub event_type: String,
    pub threshold: u32,
    pub time_window_minutes: u64,
    pub notification_email: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct RetentionPolicyRequest {
    pub max_age_days: u64,
    pub max_entries: u64,
    pub archive_enabled: bool,
}

fn parse_event_type(value: &str) -> Option<AuditEventType> {
    match value {
        "contract" => Some(AuditEventType::Contract),
        "admin" => Some(AuditEventType::Admin),
        "system" => Some(AuditEventType::System),
        "security" => Some(AuditEventType::Security),
        "export" => Some(AuditEventType::Export),
        _ => None,
    }
}

fn parse_action(value: &str) -> Option<AuditAction> {
    match value {
        "create" => Some(AuditAction::Create),
        "update" => Some(AuditAction::Update),
        "delete" => Some(AuditAction::Delete),
        "read" => Some(AuditAction::Read),
        "approve" => Some(AuditAction::Approve),
        "reject" => Some(AuditAction::Reject),
        "login" => Some(AuditAction::Login),
        "logout" => Some(AuditAction::Logout),
        "export" => Some(AuditAction::Export),
        _ => None,
    }
}

fn parse_date(value: &Option<String>) -> Option<chrono::DateTime<chrono::Utc>> {
    value
        .as_ref()
        .and_then(|d| DateTime::parse_from_rfc3339(d).ok().map(|dt| dt.to_utc()))
}

pub async fn list_audit_logs(audit: web::Data<AuditService>, query: web::Query<AuditLogQueryParams>) -> HttpResponse {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let errors = validate_pagination(page, limit);
    if !errors.is_empty() {
        return error_response(&errors);
    }

    let audit_query = AuditQuery {
        event_type: query.event_type.as_deref().and_then(parse_event_type),
        user_id: query.user_id.clone(),
        action: query.action.as_deref().and_then(parse_action),
        resource_type: query.resource_type.clone(),
        start_date: parse_date(&query.start_date),
        end_date: parse_date(&query.end_date),
        severity: query.severity.clone(),
        limit: Some(limit),
        offset: Some((page - 1) * limit),
    };

    let response = audit.list_paginated(audit_query, page, limit);
    HttpResponse::Ok().json(ApiBuilder::success_response(response))
}

pub async fn get_audit_entry(audit: web::Data<AuditService>, path: web::Path<String>) -> HttpResponse {
    let entry_id = path.into_inner();
    match audit.get_entry(&entry_id) {
        Some(entry) => HttpResponse::Ok().json(ApiBuilder::success_response(entry)),
        None => HttpResponse::NotFound().json(ApiBuilder::error_response::<String>("Audit entry not found")),
    }
}

pub async fn get_audit_summary(audit: web::Data<AuditService>) -> HttpResponse {
    let summary = audit.get_summary();
    HttpResponse::Ok().json(ApiBuilder::success_response(summary))
}

pub async fn generate_audit_report(
    audit: web::Data<AuditService>,
    body: web::Json<AuditReportRequest>,
) -> HttpResponse {
    let start = match DateTime::parse_from_rfc3339(&body.start_date) {
        Ok(dt) => dt.to_utc(),
        Err(_) => {
            return HttpResponse::BadRequest().json(ApiBuilder::error_response::<String>("Invalid start_date format"));
        }
    };
    let end = match DateTime::parse_from_rfc3339(&body.end_date) {
        Ok(dt) => dt.to_utc(),
        Err(_) => {
            return HttpResponse::BadRequest().json(ApiBuilder::error_response::<String>("Invalid end_date format"));
        }
    };

    let event_types = body
        .event_types
        .as_ref()
        .map(|v| v.iter().filter_map(|s| parse_event_type(s)).collect::<Vec<_>>());

    let report = audit.generate_report(start, end, event_types, body.group_by.clone());

    HttpResponse::Ok().json(ApiBuilder::success_response(report))
}

pub async fn export_audit_logs(audit: web::Data<AuditService>, query: web::Query<AuditLogQueryParams>) -> HttpResponse {
    let audit_query = AuditQuery {
        event_type: None,
        user_id: None,
        action: None,
        resource_type: None,
        start_date: parse_date(&query.start_date),
        end_date: parse_date(&query.end_date),
        severity: None,
        limit: None,
        offset: None,
    };

    let csv_content = audit.export_csv(audit_query);

    HttpResponse::Ok()
        .insert_header(("Content-Type", "text/csv"))
        .insert_header(("Content-Disposition", "attachment; filename=\"audit_log_export.csv\""))
        .body(csv_content)
}

pub async fn create_alert_rule(audit: web::Data<AuditService>, body: web::Json<AlertRuleRequest>) -> HttpResponse {
    let rule = AlertRule {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: body.event_type.clone(),
        threshold: body.threshold,
        time_window_minutes: body.time_window_minutes,
        notification_email: body.notification_email.clone(),
        enabled: body.enabled,
    };

    let created = audit.create_alert_rule(rule);
    HttpResponse::Created().json(ApiBuilder::success_response(created))
}

pub async fn list_alert_rules(audit: web::Data<AuditService>) -> HttpResponse {
    let rules = audit.get_alert_rules();
    HttpResponse::Ok().json(ApiBuilder::success_response(rules))
}

pub async fn get_retention_policy(audit: web::Data<AuditService>) -> HttpResponse {
    let policy = audit.get_retention_policy();
    HttpResponse::Ok().json(ApiBuilder::success_response(policy))
}

pub async fn update_retention_policy(
    audit: web::Data<AuditService>,
    body: web::Json<RetentionPolicyRequest>,
) -> HttpResponse {
    let policy = RetentionPolicy {
        max_age_days: body.max_age_days,
        max_entries: body.max_entries,
        archive_enabled: body.archive_enabled,
    };

    let updated = audit.update_retention_policy(policy);
    HttpResponse::Ok().json(ApiBuilder::success_response(updated))
}

pub async fn purge_old_logs(audit: web::Data<AuditService>) -> HttpResponse {
    let purged = audit.purge_old_entries();
    HttpResponse::Ok().json(ApiBuilder::success_response(audit.purge_summary(purged)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::audit::AuditService;

    fn setup_audit_service() -> AuditService {
        let service = AuditService::new();
        service.log_entry(
            AuditEventType::Contract,
            AuditAction::Create,
            "user-001",
            "waste",
            "Created waste record waste-001",
            "192.168.1.1",
            "medium",
        );
        service.log_entry(
            AuditEventType::Admin,
            AuditAction::Update,
            "admin-001",
            "participant",
            "Updated participant role",
            "10.0.0.1",
            "high",
        );
        service
    }

    #[actix_web::test]
    async fn test_list_audit_logs() {
        let audit = setup_audit_service();
        let query = web::Query(AuditLogQueryParams {
            page: Some(1),
            limit: Some(10),
            event_type: None,
            user_id: None,
            action: None,
            resource_type: None,
            start_date: None,
            end_date: None,
            severity: None,
        });
        let resp = list_audit_logs(web::Data::new(audit), query).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_get_audit_entry() {
        let audit = setup_audit_service();
        let entry_id = audit.query(AuditQuery {
            event_type: None,
            user_id: None,
            action: None,
            resource_type: None,
            start_date: None,
            end_date: None,
            severity: None,
            limit: Some(1),
            offset: None,
        })[0]
            .id
            .clone();
        let resp = get_audit_entry(web::Data::new(audit), web::Path::from(entry_id)).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_get_audit_summary() {
        let audit = setup_audit_service();
        let resp = get_audit_summary(web::Data::new(audit)).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_export_audit_logs() {
        let audit = setup_audit_service();
        let query = web::Query(AuditLogQueryParams {
            page: None,
            limit: None,
            event_type: None,
            user_id: None,
            action: None,
            resource_type: None,
            start_date: None,
            end_date: None,
            severity: None,
        });
        let resp = export_audit_logs(web::Data::new(audit), query).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_create_alert_rule() {
        let audit = AuditService::new();
        let body = web::Json(AlertRuleRequest {
            event_type: "security".to_string(),
            threshold: 10,
            time_window_minutes: 60,
            notification_email: Some("admin@scavenger.io".to_string()),
            enabled: true,
        });
        let resp = create_alert_rule(web::Data::new(audit), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::CREATED);
    }

    #[actix_web::test]
    async fn test_update_retention_policy() {
        let audit = AuditService::new();
        let body = web::Json(RetentionPolicyRequest {
            max_age_days: 90,
            max_entries: 1000000,
            archive_enabled: true,
        });
        let resp = update_retention_policy(web::Data::new(audit), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_purge_old_logs() {
        let audit = setup_audit_service();
        let resp = purge_old_logs(web::Data::new(audit)).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_list_audit_logs_invalid_pagination() {
        let audit = setup_audit_service();
        let query = web::Query(AuditLogQueryParams {
            page: Some(0),
            limit: Some(10),
            event_type: None,
            user_id: None,
            action: None,
            resource_type: None,
            start_date: None,
            end_date: None,
            severity: None,
        });
        let resp = list_audit_logs(web::Data::new(audit), query).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_list_audit_logs_with_filters() {
        let audit = setup_audit_service();
        let query = web::Query(AuditLogQueryParams {
            page: Some(1),
            limit: Some(10),
            event_type: Some("contract".to_string()),
            user_id: Some("user-001".to_string()),
            action: Some("create".to_string()),
            resource_type: Some("waste".to_string()),
            start_date: Some("2020-01-01T00:00:00Z".to_string()),
            end_date: Some("2999-01-01T00:00:00Z".to_string()),
            severity: Some("medium".to_string()),
        });
        let resp = list_audit_logs(web::Data::new(audit), query).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_get_audit_entry_not_found() {
        let audit = AuditService::new();
        let resp = get_audit_entry(web::Data::new(audit), web::Path::from("missing".to_string())).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_generate_audit_report_invalid_dates() {
        let audit = setup_audit_service();
        let body = web::Json(AuditReportRequest {
            start_date: "not-a-date".to_string(),
            end_date: "2024-01-01T00:00:00Z".to_string(),
            event_types: None,
            group_by: None,
        });
        let resp = generate_audit_report(web::Data::new(audit), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_generate_audit_report_success() {
        let audit = setup_audit_service();
        let body = web::Json(AuditReportRequest {
            start_date: "2020-01-01T00:00:00Z".to_string(),
            end_date: "2999-01-01T00:00:00Z".to_string(),
            event_types: Some(vec!["contract".to_string(), "admin".to_string()]),
            group_by: Some("event_type".to_string()),
        });
        let resp = generate_audit_report(web::Data::new(audit), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_list_alert_rules() {
        let audit = AuditService::new();
        let resp = list_alert_rules(web::Data::new(audit)).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_get_retention_policy() {
        let audit = AuditService::new();
        let resp = get_retention_policy(web::Data::new(audit)).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }
}
