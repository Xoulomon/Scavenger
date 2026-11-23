//! OpenAPI document endpoint.
//!
//! Serves the machine-readable OpenAPI 3.0.3 specification as JSON at
//! `GET /api/v1/openapi.json` (see route registration in `main.rs`).

use actix_web::{web, HttpResponse};
use serde_json::json;

/// Handler for `GET /api/v1/openapi.json`.
///
/// Returns a minimal OpenAPI 3.0.3 document including the shared
/// `ErrorBody` schema used by the API's error responses.
pub async fn openapi_json() -> HttpResponse {
    let document = json!({
        "openapi": "3.0.3",
        "info": {
            "title": "Scavenger API",
            "version": "0.1.0",
            "description": "REST API for the Scavenger platform."
        },
        "paths": {},
        "components": {
            "schemas": {
                "ErrorBody": {
                    "type": "object",
                    "description": "Standard error payload returned by the API.",
                    "properties": {
                        "error": { "type": "string" },
                        "message": { "type": "string" },
                        "code": { "type": "string" }
                    },
                    "required": ["error", "message"]
                }
            }
        }
    });
    HttpResponse::Ok().json(document)
}
