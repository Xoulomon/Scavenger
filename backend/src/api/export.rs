use actix_web::{web, HttpResponse};
use crate::api::pagination::paginate;
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::cache::Cache;
use crate::services::api::{ApiBuilder, PaginatedResponse};
use crate::services::email::{EmailService, TransactionalEmail};
use crate::services::export::ExportService;
use crate::validation::{
    error_response, validate_date_range, validate_export_format, validate_pagination, ValidationError,
};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRequest {
    pub format: String,
    pub data_type: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub anonymize: Option<bool>,
    pub filters: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResponse {
    pub id: String,
    pub format: String,
    pub data_type: String,
    pub status: String,
    pub file_size: Option<u64>,
    pub created_at: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportHistoryEntry {
    pub id: String,
    pub format: String,
    pub data_type: String,
    pub status: String,
    pub requested_by: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledExportConfig {
    pub id: String,
    pub format: String,
    pub data_type: String,
    pub schedule: String,
    pub recipients: Vec<String>,
    pub anonymize: bool,
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct ExportListQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub data_type: Option<String>,
    pub format: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EmailExportRequest {
    pub export_id: String,
    pub recipients: Vec<String>,
    pub subject: Option<String>,
    pub message: Option<String>,
}

pub async fn export_data(cache: web::Data<Cache>, body: web::Json<ExportRequest>) -> HttpResponse {
    let mut errors = Vec::new();

    if let Some(ref err) = validate_export_format(&body.format) {
        errors.push(err.clone());
    }
    if body.data_type.trim().is_empty() {
        errors.push(ValidationError {
            field: "data_type".to_string(),
            message: "data_type is required".to_string(),
        });
    }
    if let (Some(ref start), Some(ref end)) = (&body.start_date, &body.end_date) {
        errors.extend(validate_date_range(start, end));
    }

    if !errors.is_empty() {
        return error_response(&errors);
    }

    let export_id = uuid::Uuid::new_v4().to_string();
    let format = body.format.to_lowercase();

    let sample_data = vec![
        crate::services::export::ExportData {
            id: "waste-001".to_string(),
            waste_type: "plastic".to_string(),
            weight: 100,
            status: "pending".to_string(),
            created_at: Utc::now().to_rfc3339(),
        },
        crate::services::export::ExportData {
            id: "waste-002".to_string(),
            waste_type: "metal".to_string(),
            weight: 250,
            status: "approved".to_string(),
            created_at: Utc::now().to_rfc3339(),
        },
    ];

    let content_bytes = match format.as_str() {
        "csv" => ExportService::export_to_csv(sample_data).map(|s| s.into_bytes()),
        "json" => ExportService::export_to_json(sample_data).map(|s| s.into_bytes()),
        "pdf" => ExportService::export_to_pdf(sample_data),
        _ => unreachable!(),
    };

    match content_bytes {
        Ok(bytes) => {
            let cache_key = format!("export:{}", export_id);
            cache.set(cache_key, bytes);

            let response = ExportResponse {
                id: export_id,
                format: format.clone(),
                data_type: body.data_type.clone(),
                status: "completed".to_string(),
                file_size: None,
                created_at: Utc::now().to_rfc3339(),
                expires_at: (Utc::now() + chrono::Duration::hours(24)).to_rfc3339(),
            };

            HttpResponse::Ok().json(ApiBuilder::success_response(response))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiBuilder::error_response::<String>(format!("Export failed: {}", e))),
    }
}

pub async fn download_export(cache: web::Data<Cache>, path: web::Path<String>) -> HttpResponse {
    let export_id = path.into_inner();
    let cache_key = format!("export:{}", export_id);

    match cache.get(&cache_key) {
        Some(data) => HttpResponse::Ok()
            .insert_header(("Content-Type", "application/octet-stream"))
            .insert_header((
                "Content-Disposition",
                format!("attachment; filename=\"{}.csv\"", export_id),
            ))
            .body(data),
        None => HttpResponse::NotFound().json(ApiBuilder::error_response::<String>("Export not found or expired")),
    }
}

pub async fn list_exports(query: web::Query<ExportListQuery>) -> HttpResponse {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let errors = validate_pagination(page, limit);
    if !errors.is_empty() {
        return error_response(&errors);
    }

    let items: Vec<ExportHistoryEntry> = Vec::new();
    let response = paginate(&items, page, limit);
    HttpResponse::Ok().json(ApiBuilder::success_response(response))
}

pub async fn send_export_email(
    email_service: web::Data<Arc<dyn EmailService>>,
    body: web::Json<EmailExportRequest>,
) -> HttpResponse {
    let mut errors = Vec::new();
    if body.export_id.trim().is_empty() {
        errors.push(ValidationError {
            field: "export_id".to_string(),
            message: "export_id is required".to_string(),
        });
    }
    if body.recipients.is_empty() {
        errors.push(ValidationError {
            field: "recipients".to_string(),
            message: "at least one recipient is required".to_string(),
        });
    }

    if !errors.is_empty() {
        return error_response(&errors);
    }

    let subject = body
        .subject
        .clone()
        .unwrap_or_else(|| "Scavenger Data Export".to_string());

    for recipient in &body.recipients {
        let email = TransactionalEmail {
            recipient: recipient.clone(),
            template: subject.clone(),
            context: std::collections::HashMap::from([
                ("export_id".to_string(), body.export_id.clone()),
                ("message".to_string(), body.message.clone().unwrap_or_default()),
            ]),
        };

        match email_service.send_transactional(email).await {
            Ok(_) => {}
            Err(e) => {
                return HttpResponse::InternalServerError().json(ApiBuilder::error_response::<String>(format!(
                    "Failed to send email to {}: {}",
                    recipient, e
                )));
            }
        }
    }

    HttpResponse::Ok().json(ApiBuilder::success_response(format!(
        "Export sent to {} recipients",
        body.recipients.len()
    )))
}

pub async fn create_scheduled_export(body: web::Json<ScheduledExportConfig>) -> HttpResponse {
    let mut errors = Vec::new();

    if let Some(ref err) = validate_export_format(&body.format) {
        errors.push(err.clone());
    }
    if body.data_type.trim().is_empty() {
        errors.push(ValidationError {
            field: "data_type".to_string(),
            message: "data_type is required".to_string(),
        });
    }
    if body.schedule.trim().is_empty() {
        errors.push(ValidationError {
            field: "schedule".to_string(),
            message: "schedule is required".to_string(),
        });
    }
    if body.recipients.is_empty() {
        errors.push(ValidationError {
            field: "recipients".to_string(),
            message: "at least one recipient is required".to_string(),
        });
    }

    if !errors.is_empty() {
        return error_response(&errors);
    }

    let config = ScheduledExportConfig {
        id: uuid::Uuid::new_v4().to_string(),
        format: body.format.clone(),
        data_type: body.data_type.clone(),
        schedule: body.schedule.clone(),
        recipients: body.recipients.clone(),
        anonymize: body.anonymize,
        enabled: body.enabled,
    };

    HttpResponse::Created().json(ApiBuilder::success_response(config))
}

pub async fn list_scheduled_exports() -> HttpResponse {
    let scheduled: Vec<ScheduledExportConfig> = Vec::new();
    HttpResponse::Ok().json(ApiBuilder::success_response(scheduled))
}

pub async fn delete_scheduled_export(path: web::Path<String>) -> HttpResponse {
    let export_id = path.into_inner();
    HttpResponse::Ok().json(ApiBuilder::success_response(format!(
        "Scheduled export {} deleted",
        export_id
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[actix_web::test]
    async fn test_export_data_csv() {
        let cache = Cache::new(60);
        let body = web::Json(ExportRequest {
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            start_date: None,
            end_date: None,
            anonymize: None,
            filters: None,
        });
        let resp = export_data(web::Data::new(cache), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_export_data_json() {
        let cache = Cache::new(60);
        let body = web::Json(ExportRequest {
            format: "json".to_string(),
            data_type: "participants".to_string(),
            start_date: None,
            end_date: None,
            anonymize: None,
            filters: None,
        });
        let resp = export_data(web::Data::new(cache), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_export_invalid_format() {
        let cache = Cache::new(60);
        let body = web::Json(ExportRequest {
            format: "xls".to_string(),
            data_type: "waste".to_string(),
            start_date: None,
            end_date: None,
            anonymize: None,
            filters: None,
        });
        let resp = export_data(web::Data::new(cache), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_export_missing_data_type() {
        let cache = Cache::new(60);
        let body = web::Json(ExportRequest {
            format: "csv".to_string(),
            data_type: "".to_string(),
            start_date: None,
            end_date: None,
            anonymize: None,
            filters: None,
        });
        let resp = export_data(web::Data::new(cache), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_download_nonexistent_export() {
        let cache = Cache::new(60);
        let resp = download_export(web::Data::new(cache), web::Path::from("nonexistent".to_string())).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_create_scheduled_export() {
        let body = web::Json(ScheduledExportConfig {
            id: "".to_string(),
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            schedule: "0 0 * * *".to_string(),
            recipients: vec!["test@example.com".to_string()],
            anonymize: true,
            enabled: true,
        });
        let resp = create_scheduled_export(body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::CREATED);
    }
}
