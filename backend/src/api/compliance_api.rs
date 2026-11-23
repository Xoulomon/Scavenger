//! Compliance API - HTTP Layer Only
//!
//! This file handles only HTTP request/response mapping.
//! All business logic has been moved to the compliance/ module.

use actix_web::{web, HttpResponse, Responder};

// Import domain logic from compliance module
use crate::compliance::{CheckRequest, ComplianceError, ComplianceService, ComplianceValidator};

/// Compliance check endpoint - HTTP layer only
pub async fn check_compliance(req: web::Json<CheckRequest>) -> impl Responder {
    let service = ComplianceService::new();
    let validator = ComplianceValidator::new();

    // Validate the request
    if let Err(e) = validator.validate_check(&req) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation failed",
            "message": e.to_string()
        }));
    }

    // Delegate to service (business logic)
    match service.check_compliance(req.into_inner()).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(e) => map_compliance_error(e),
    }
}

/// Map a domain error to an HTTP response (controller responsibility only).
fn map_compliance_error(e: ComplianceError) -> HttpResponse {
    match e {
        ComplianceError::InvalidAmount(msg) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid request",
            "message": msg
        })),
        ComplianceError::ValidationError(msg) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Validation error",
            "message": msg
        })),
        ComplianceError::CheckFailed(msg) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Compliance check failed",
            "message": msg
        })),
    }
}

/// Get compliance status endpoint - HTTP layer only
pub async fn get_compliance_status(path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();

    let service = ComplianceService::new();

    match service.get_status(id).await {
        Ok(status) => HttpResponse::Ok().json(serde_json::json!({
            "status": format!("{:?}", status)
        })),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Not found",
            "message": e.to_string()
        })),
    }
}

/// Health check endpoint
pub async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "compliance"
    }))
}

/// Route configuration
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/compliance")
            .route("/check", web::post().to(check_compliance))
            .route("/status/{id}", web::get().to(get_compliance_status))
            .route("/health", web::get().to(health_check)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};

    #[actix_web::test]
    async fn health_check_returns_ok() {
        let app = test::init_service(App::new().configure(configure)).await;

        let req = test::TestRequest::get().uri("/api/compliance/health").to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }

    #[actix_web::test]
    async fn check_compliance_rejects_invalid_request() {
        let app = test::init_service(App::new().configure(configure)).await;

        // Empty/invalid body should be rejected at the HTTP layer (400).
        let req = test::TestRequest::post()
            .uri("/api/compliance/check")
            .set_json(serde_json::json!({}))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn get_status_unknown_id_returns_not_found() {
        let app = test::init_service(App::new().configure(configure)).await;

        let req = test::TestRequest::get()
            .uri("/api/compliance/status/does-not-exist")
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::NOT_FOUND);
    }

    #[test]
    fn map_invalid_amount_is_bad_request() {
        let resp = map_compliance_error(ComplianceError::InvalidAmount("bad".into()));
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[test]
    fn map_validation_error_is_bad_request() {
        let resp = map_compliance_error(ComplianceError::ValidationError("bad".into()));
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[test]
    fn map_check_failed_is_internal_server_error() {
        let resp = map_compliance_error(ComplianceError::CheckFailed("boom".into()));
        assert_eq!(resp.status(), actix_web::http::StatusCode::INTERNAL_SERVER_ERROR);
    }
}
