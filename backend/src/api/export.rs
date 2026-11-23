//! Export API endpoints for data export functionality
//!
//! This module provides endpoints for exporting various data types
//! in different formats (CSV, JSON).
//!
//! Note: Legacy formats have been removed as part of #1077.
//! Active formats: CSV, JSON.

use actix_web::{web, HttpResponse};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::{
    cache::Cache,
    error::ApiError,
    services::api::{ApiBuilder, PaginatedResponse},
    services::export::{ExportService, ExportServiceTrait},
    validation::{error_response, validate_date_range, validate_export_format, validate_pagination, ValidationError},
};

// ============================================
// Types
// ============================================

/// Export format options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Json,
    // Removed: Excel, XML, PDF (legacy formats, no active usage)
}

/// Export request parameters
#[derive(Debug, Clone, Deserialize)]
pub struct ExportQuery {
    pub format: ExportFormat,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub limit: Option<u32>,
}

/// Export request body
#[derive(Debug, Clone, Deserialize)]
pub struct ExportRequest {
    pub format: String,
    pub data_type: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

/// Export response
#[derive(Debug, Serialize)]
pub struct ExportResponse {
    pub id: String,
    pub format: String,
    pub data_type: String,
    pub status: String,
    pub file_size: Option<u64>,
    pub created_at: String,
    pub expires_at: String,
}

/// Export list query
#[derive(Debug, Clone, Deserialize)]
pub struct ExportListQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

// ============================================
// Endpoint Handlers
// ============================================

/// Export data
///
/// POST /api/export
/// Body: { format, data_type, start_date, end_date }
pub async fn export_data(cache: web::Data<Cache>, body: web::Json<ExportRequest>) -> HttpResponse {
    let service = ExportService::new(cache.get_ref().clone());
    export_data_with_service(&service, body).await
}

/// Controller logic for `export_data`, decoupled from the concrete service
/// so it can be unit tested with a mock implementation.
async fn export_data_with_service<S: ExportServiceTrait>(service: &S, body: web::Json<ExportRequest>) -> HttpResponse {
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

    match service
        .create_export(
            &body.format,
            &body.data_type,
            body.start_date.as_deref(),
            body.end_date.as_deref(),
        )
        .await
    {
        Ok(result) => {
            let response = ExportResponse {
                id: result.id,
                format: result.format,
                data_type: result.data_type,
                status: result.status,
                file_size: result.file_size,
                created_at: result.created_at,
                expires_at: result.expires_at,
            };
            HttpResponse::Ok().json(ApiBuilder::success_response(response))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiBuilder::error_response::<String>(format!("Export failed: {}", e))),
    }
}

/// Download export
///
/// GET /api/export/{export_id}
pub async fn download_export(cache: web::Data<Cache>, path: web::Path<String>) -> HttpResponse {
    let service = ExportService::new(cache.get_ref().clone());
    download_export_with_service(&service, path).await
}

/// Controller logic for `download_export`, decoupled from the concrete service.
async fn download_export_with_service<S: ExportServiceTrait>(service: &S, path: web::Path<String>) -> HttpResponse {
    let export_id = path.into_inner();

    match service.get_export_content(&export_id).await {
        Ok(Some(data)) => HttpResponse::Ok()
            .insert_header(("Content-Type", "application/octet-stream"))
            .insert_header((
                "Content-Disposition",
                format!("attachment; filename=\"{}.csv\"", export_id),
            ))
            .body(data),
        Ok(None) => HttpResponse::NotFound().json(ApiBuilder::error_response::<String>("Export not found or expired")),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiBuilder::error_response::<String>(format!("Export failed: {}", e))),
    }
}

/// List exports
///
/// GET /api/exports
/// Query: page, limit
pub async fn list_exports(cache: web::Data<Cache>, query: web::Query<ExportListQuery>) -> HttpResponse {
    let service = ExportService::new(cache.get_ref().clone());
    list_exports_with_service(&service, query).await
}

/// Controller logic for `list_exports`, decoupled from the concrete service.
async fn list_exports_with_service<S: ExportServiceTrait>(
    service: &S,
    query: web::Query<ExportListQuery>,
) -> HttpResponse {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let errors = validate_pagination(page, limit);
    if !errors.is_empty() {
        return error_response(&errors);
    }

    // Export history persistence is not yet implemented; return an empty page.
    let items: Vec<ExportResponse> = Vec::new();
    let total = items.len() as u64;
    let response = serde_json::json!({
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
    });
    HttpResponse::Ok().json(ApiBuilder::success_response(response))
}

/// Create scheduled export
///
/// POST /api/export/schedule
pub async fn create_scheduled_export(cache: web::Data<Cache>, body: web::Json<ScheduledExportConfig>) -> HttpResponse {
    let service = ExportService::new(cache.get_ref().clone());
    create_scheduled_export_with_service(&service, body).await
}

/// Controller logic for `create_scheduled_export`, decoupled from the concrete service.
async fn create_scheduled_export_with_service<S: ExportServiceTrait>(
    service: &S,
    body: web::Json<ScheduledExportConfig>,
) -> HttpResponse {
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

    match service
        .create_scheduled_export(
            &body.format,
            &body.data_type,
            &body.schedule,
            &body.recipients,
            body.subject.as_deref(),
        )
        .await
    {
        Ok(_) => HttpResponse::Ok().json(ApiBuilder::success_response("Scheduled export created")),
        Err(e) => HttpResponse::InternalServerError().json(ApiBuilder::error_response::<String>(format!(
            "Failed to create scheduled export: {}",
            e
        ))),
    }
}

/// Delete scheduled export
///
/// DELETE /api/export/schedule/{id}
pub async fn delete_scheduled_export(cache: web::Data<Cache>, path: web::Path<String>) -> HttpResponse {
    let service = ExportService::new(cache.get_ref().clone());
    delete_scheduled_export_with_service(&service, path).await
}

/// Controller logic for `delete_scheduled_export`, decoupled from the concrete service.
async fn delete_scheduled_export_with_service<S: ExportServiceTrait>(
    service: &S,
    path: web::Path<String>,
) -> HttpResponse {
    let export_id = path.into_inner();

    match service.delete_scheduled_export(&export_id).await {
        Ok(_) => HttpResponse::Ok().json(ApiBuilder::success_response(format!(
            "Scheduled export {} deleted",
            export_id
        ))),
        Err(e) => HttpResponse::InternalServerError().json(ApiBuilder::error_response::<String>(format!(
            "Failed to delete scheduled export: {}",
            e
        ))),
    }
}
// ============================================
// Route Registration
// ============================================

/// Configure export routes
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .route("/export", web::post().to(export_data))
            .route("/export/{export_id}", web::get().to(download_export))
            .route("/exports", web::get().to(list_exports)),
    );
}

// ============================================
// Changelog
// ============================================

///
/// # Changelog - Export Endpoints
///
/// ## Removed (Issue #1077)
/// - `GET /api/export/excel` - Legacy Excel format (no active usage)
/// - `GET /api/export/xml` - Legacy XML format (no active usage)
/// - `GET /api/export/pdf` - Legacy PDF format (no active usage)
/// - `GET /api/export/legacy` - Legacy endpoint (no active usage)
///
/// ## Removed (Issue #1700)
/// - `POST /api/export/send-email` - Unused email export handler (referenced
///   undefined `EmailService`/`TransactionalEmail` types; never functional)
/// - `POST /api/export/schedule` - Unused scheduled export stub (no persistence)
/// - `DELETE /api/export/schedule/{id}` - Unused scheduled export deletion stub
///
/// ## Kept (Active)
/// - `POST /api/export` - CSV and JSON formats
/// - `GET /api/export/{id}` - Download export
/// - `GET /api/exports` - List exports
///
/// ## Migration
/// Clients should migrate to the active endpoints:
/// - Use `format=csv` for CSV data
/// - Use `format=json` for JSON data
///
/// ## Date
/// 2024-01-15: Legacy endpoints removed
/// 2024-02-01: Unused/deprecated handlers removed (#1700)
///

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_export_format_serialization() {
        let format = ExportFormat::Csv;
        let json = serde_json::to_string(&format).unwrap();
        assert_eq!(json, "\"csv\"");
    }

    #[test]
    fn test_export_response_serialization() {
        let response = ExportResponse {
            id: "test-123".to_string(),
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            status: "completed".to_string(),
            file_size: Some(1024),
            created_at: Utc::now().to_rfc3339(),
            expires_at: (Utc::now() + chrono::Duration::hours(24)).to_rfc3339(),
        };
        let json = serde_json::to_value(&response).unwrap();
        assert!(json.get("id").is_some());
        assert!(json.get("format").is_some());
        assert!(json.get("data_type").is_some());
    }

    #[test]
    fn test_export_format_deserialization() {
        let json = "\"csv\"";
        let format: ExportFormat = serde_json::from_str(json).unwrap();
        match format {
            ExportFormat::Csv => assert!(true),
            _ => assert!(false),
        }
    }

    #[test]
    fn test_invalid_format_deserialization() {
        let json = "\"xml\"";
        let result: Result<ExportFormat, _> = serde_json::from_str(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_export_list_query_defaults() {
        let query: ExportListQuery = serde_json::from_str("{}").unwrap();
        assert!(query.page.is_none());
        assert!(query.limit.is_none());
    }

    #[test]
    fn test_export_list_query_values() {
        let query: ExportListQuery = serde_json::from_str(r#"{"page":2,"limit":50}"#).unwrap();
        assert_eq!(query.page, Some(2));
        assert_eq!(query.limit, Some(50));
    }

    #[test]
    fn test_export_request_deserialization() {
        let request: ExportRequest = serde_json::from_str(r#"{"format":"csv","data_type":"waste"}"#).unwrap();
        assert_eq!(request.format, "csv");
        assert_eq!(request.data_type, "waste");
        assert!(request.start_date.is_none());
        assert!(request.end_date.is_none());
    }

    // ============================================
    // Controller tests with mocked service
    // ============================================

    use crate::services::export::{ExportResult, ScheduledExportResult};
    use async_trait::async_trait;
    use std::sync::Mutex;

    #[derive(Default)]
    struct MockExportService {
        create_export_result: Mutex<Option<Result<ExportResult, String>>>,
        get_content_result: Mutex<Option<Result<Option<Vec<u8>>, String>>>,
        list_result: Mutex<Option<Result<PaginatedResponse<ExportHistoryEntry>, String>>>,
        create_schedule_result: Mutex<Option<Result<ScheduledExportResult, String>>>,
        delete_schedule_result: Mutex<Option<Result<(), String>>>,
    }

    #[async_trait]
    impl ExportServiceTrait for MockExportService {
        async fn create_export(
            &self,
            _format: &str,
            _data_type: &str,
            _start_date: Option<&str>,
            _end_date: Option<&str>,
        ) -> Result<ExportResult, String> {
            self.create_export_result
                .lock()
                .unwrap()
                .take()
                .unwrap_or_else(|| Err("not configured".to_string()))
        }

        async fn get_export_content(&self, _export_id: &str) -> Result<Option<Vec<u8>>, String> {
            self.get_content_result
                .lock()
                .unwrap()
                .take()
                .unwrap_or_else(|| Ok(None))
        }

        async fn list_exports(&self, _page: u32, _limit: u32) -> Result<PaginatedResponse<ExportHistoryEntry>, String> {
            self.list_result
                .lock()
                .unwrap()
                .take()
                .unwrap_or_else(|| Err("not configured".to_string()))
        }

        async fn create_scheduled_export(
            &self,
            _format: &str,
            _data_type: &str,
            _schedule: &str,
            _recipients: &[String],
            _subject: Option<&str>,
        ) -> Result<ScheduledExportResult, String> {
            self.create_schedule_result
                .lock()
                .unwrap()
                .take()
                .unwrap_or_else(|| Err("not configured".to_string()))
        }

        async fn delete_scheduled_export(&self, _export_id: &str) -> Result<(), String> {
            self.delete_schedule_result
                .lock()
                .unwrap()
                .take()
                .unwrap_or_else(|| Ok(()))
        }
    }

    fn sample_export_result() -> ExportResult {
        ExportResult {
            id: "test-123".to_string(),
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            status: "completed".to_string(),
            file_size: None,
            created_at: Utc::now().to_rfc3339(),
            expires_at: (Utc::now() + chrono::Duration::hours(24)).to_rfc3339(),
        }
    }

    #[actix_web::test]
    async fn test_export_data_success() {
        let service = MockExportService::default();
        *service.create_export_result.lock().unwrap() = Some(Ok(sample_export_result()));

        let body = web::Json(ExportRequest {
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            start_date: None,
            end_date: None,
        });

        let resp = export_data_with_service(&service, body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_export_data_validation_error() {
        let service = MockExportService::default();
        let body = web::Json(ExportRequest {
            format: "xml".to_string(),
            data_type: "".to_string(),
            start_date: None,
            end_date: None,
        });

        let resp = export_data_with_service(&service, body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_export_data_service_error() {
        let service = MockExportService::default();
        *service.create_export_result.lock().unwrap() = Some(Err("boom".to_string()));

        let body = web::Json(ExportRequest {
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            start_date: None,
            end_date: None,
        });

        let resp = export_data_with_service(&service, body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[actix_web::test]
    async fn test_download_export_found() {
        let service = MockExportService::default();
        *service.get_content_result.lock().unwrap() = Some(Ok(Some(b"data".to_vec())));

        let resp = download_export_with_service(&service, web::Path::from("abc".to_string())).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_download_export_not_found() {
        let service = MockExportService::default();
        *service.get_content_result.lock().unwrap() = Some(Ok(None));

        let resp = download_export_with_service(&service, web::Path::from("abc".to_string())).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_list_exports_success() {
        let service = MockExportService::default();
        *service.list_result.lock().unwrap() = Some(Ok(PaginatedResponse {
            items: Vec::new(),
            page: 1,
            limit: 20,
            total: 0,
            total_pages: 0,
        }));

        let resp = list_exports_with_service(
            &service,
            web::Query(ExportListQuery {
                page: Some(1),
                limit: Some(20),
            }),
        )
        .await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_list_exports_invalid_pagination() {
        let service = MockExportService::default();
        let resp = list_exports_with_service(
            &service,
            web::Query(ExportListQuery {
                page: Some(0),
                limit: Some(0),
            }),
        )
        .await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_create_scheduled_export_success() {
        let service = MockExportService::default();
        *service.create_schedule_result.lock().unwrap() = Some(Ok(ScheduledExportResult {
            id: "sched-1".to_string(),
        }));

        let body = web::Json(ScheduledExportConfig {
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            schedule: "daily".to_string(),
            recipients: vec!["a@example.com".to_string()],
            subject: None,
        });

        let resp = create_scheduled_export_with_service(&service, body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_create_scheduled_export_validation_error() {
        let service = MockExportService::default();
        let body = web::Json(ScheduledExportConfig {
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            schedule: "".to_string(),
            recipients: vec![],
            subject: None,
        });

        let resp = create_scheduled_export_with_service(&service, body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn test_delete_scheduled_export_success() {
        let service = MockExportService::default();
        *service.delete_schedule_result.lock().unwrap() = Some(Ok(()));

        let resp = delete_scheduled_export_with_service(&service, web::Path::from("sched-1".to_string())).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }
}
