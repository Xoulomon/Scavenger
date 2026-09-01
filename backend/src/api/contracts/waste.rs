/// Waste-contract API handlers.
///
/// Covers every route that operates on waste records: registration,
/// status updates, transfer flows, and batch queries.  Extracted from
/// the monolithic `contracts.rs` module as part of issue #1075 to keep
/// each submodule under ~300 lines and to reduce merge-conflict surface.
use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use crate::api::errors::ApiError;

// ── Request / response shapes ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterWasteRequest {
    pub participant_id: String,
    pub waste_type: String,
    pub quantity_kg: f64,
    pub location: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WasteResponse {
    pub waste_id: String,
    pub participant_id: String,
    pub waste_type: String,
    pub quantity_kg: f64,
    pub status: String,
    pub location: Option<String>,
    pub registered_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransferWasteRequest {
    pub waste_id: String,
    pub from_participant: String,
    pub to_participant: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateWasteStatusRequest {
    pub waste_id: String,
    pub new_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WasteListResponse {
    pub wastes: Vec<WasteResponse>,
    pub total: usize,
}

// ── Handlers ──────────────────────────────────────────────────────────────

/// POST /api/contracts/waste/register
///
/// Registers a new waste record on behalf of a participant.
pub async fn register_waste(
    body: web::Json<RegisterWasteRequest>,
) -> Result<HttpResponse, ApiError> {
    if body.participant_id.is_empty() {
        return Err(ApiError::validation("participant_id is required"));
    }
    if body.waste_type.is_empty() {
        return Err(ApiError::validation("waste_type is required"));
    }
    if body.quantity_kg <= 0.0 {
        return Err(ApiError::validation("quantity_kg must be positive"));
    }

    let waste_id = uuid::Uuid::new_v4().to_string();
    let response = WasteResponse {
        waste_id,
        participant_id: body.participant_id.clone(),
        waste_type: body.waste_type.clone(),
        quantity_kg: body.quantity_kg,
        status: "registered".to_string(),
        location: body.location.clone(),
        registered_at: chrono::Utc::now().to_rfc3339(),
    };

    Ok(HttpResponse::Created().json(response))
}

/// GET /api/contracts/waste/{waste_id}
///
/// Returns the details of a single waste record.
pub async fn get_waste(path: web::Path<String>) -> Result<HttpResponse, ApiError> {
    let waste_id = path.into_inner();
    if waste_id.is_empty() {
        return Err(ApiError::not_found("Waste record not found"));
    }

    let response = WasteResponse {
        waste_id: waste_id.clone(),
        participant_id: "participant-123".to_string(),
        waste_type: "plastic".to_string(),
        quantity_kg: 10.5,
        status: "registered".to_string(),
        location: None,
        registered_at: chrono::Utc::now().to_rfc3339(),
    };

    Ok(HttpResponse::Ok().json(response))
}

/// GET /api/contracts/waste/participant/{participant_id}
///
/// Returns all waste records for a given participant.
pub async fn list_participant_wastes(
    path: web::Path<String>,
) -> Result<HttpResponse, ApiError> {
    let participant_id = path.into_inner();
    if participant_id.is_empty() {
        return Err(ApiError::validation("participant_id is required"));
    }

    let response = WasteListResponse {
        wastes: vec![WasteResponse {
            waste_id: uuid::Uuid::new_v4().to_string(),
            participant_id: participant_id.clone(),
            waste_type: "plastic".to_string(),
            quantity_kg: 5.0,
            status: "registered".to_string(),
            location: None,
            registered_at: chrono::Utc::now().to_rfc3339(),
        }],
        total: 1,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// POST /api/contracts/waste/transfer
///
/// Transfers ownership of a waste record between participants.
pub async fn transfer_waste(
    body: web::Json<TransferWasteRequest>,
) -> Result<HttpResponse, ApiError> {
    if body.waste_id.is_empty() {
        return Err(ApiError::validation("waste_id is required"));
    }
    if body.from_participant.is_empty() {
        return Err(ApiError::validation("from_participant is required"));
    }
    if body.to_participant.is_empty() {
        return Err(ApiError::validation("to_participant is required"));
    }
    if body.from_participant == body.to_participant {
        return Err(ApiError::validation(
            "from_participant and to_participant must differ",
        ));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "waste_id": body.waste_id,
        "transferred": true,
        "from": body.from_participant,
        "to": body.to_participant,
        "transferred_at": chrono::Utc::now().to_rfc3339()
    })))
}

/// PATCH /api/contracts/waste/status
///
/// Updates the processing status of a waste record.
pub async fn update_waste_status(
    body: web::Json<UpdateWasteStatusRequest>,
) -> Result<HttpResponse, ApiError> {
    if body.waste_id.is_empty() {
        return Err(ApiError::validation("waste_id is required"));
    }

    let valid_statuses = ["registered", "processing", "completed", "rejected"];
    if !valid_statuses.contains(&body.new_status.as_str()) {
        return Err(ApiError::validation(&format!(
            "invalid status '{}'; must be one of: {}",
            body.new_status,
            valid_statuses.join(", ")
        )));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "waste_id": body.waste_id,
        "status": body.new_status,
        "updated_at": chrono::Utc::now().to_rfc3339()
    })))
}

// ── Route registration ─────────────────────────────────────────────────────

/// Registers all waste-contract routes under the `/api/contracts/waste` scope.
pub fn configure_waste_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/waste")
            .route("/register", web::post().to(register_waste))
            .route("/transfer", web::post().to(transfer_waste))
            .route("/status", web::patch().to(update_waste_status))
            .route("/participant/{participant_id}", web::get().to(list_participant_wastes))
            .route("/{waste_id}", web::get().to(get_waste)),
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, web, App};

    #[actix_web::test]
    async fn test_register_waste_success() {
        let app = test::init_service(
            App::new().route(
                "/waste/register",
                web::post().to(register_waste),
            ),
        )
        .await;

        let body = RegisterWasteRequest {
            participant_id: "participant-1".to_string(),
            waste_type: "plastic".to_string(),
            quantity_kg: 5.0,
            location: Some("Lagos".to_string()),
        };

        let req = test::TestRequest::post()
            .uri("/waste/register")
            .set_json(&body)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);
    }

    #[actix_web::test]
    async fn test_register_waste_missing_participant() {
        let app = test::init_service(
            App::new().route("/waste/register", web::post().to(register_waste)),
        )
        .await;

        let body = RegisterWasteRequest {
            participant_id: String::new(),
            waste_type: "plastic".to_string(),
            quantity_kg: 5.0,
            location: None,
        };

        let req = test::TestRequest::post()
            .uri("/waste/register")
            .set_json(&body)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 400);
    }

    #[actix_web::test]
    async fn test_transfer_waste_same_participant_rejected() {
        let app = test::init_service(
            App::new().route("/waste/transfer", web::post().to(transfer_waste)),
        )
        .await;

        let body = TransferWasteRequest {
            waste_id: "waste-1".to_string(),
            from_participant: "p1".to_string(),
            to_participant: "p1".to_string(),
        };

        let req = test::TestRequest::post()
            .uri("/waste/transfer")
            .set_json(&body)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 400);
    }

    #[actix_web::test]
    async fn test_update_status_invalid_value() {
        let app = test::init_service(
            App::new().route("/waste/status", web::patch().to(update_waste_status)),
        )
        .await;

        let body = UpdateWasteStatusRequest {
            waste_id: "waste-1".to_string(),
            new_status: "unknown".to_string(),
        };

        let req = test::TestRequest::patch()
            .uri("/waste/status")
            .set_json(&body)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 400);
    }
}
