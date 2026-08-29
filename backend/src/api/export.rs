//! Export API endpoints for data export functionality
//! 
//! This module provides endpoints for exporting various data types
//! in different formats (CSV, JSON, Excel).
//! 
//! Note: Legacy formats have been removed as part of #1077.
//! Active formats: CSV, JSON.

use axum::{
    extract::{Path, Query, State},
    response::{Json, IntoResponse},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, warn};

use crate::{
    auth::RequireAuth,
    error::ApiError,
    models::ExportRequest,
    services::export_service::ExportService,
    AppState,
};

// ============================================
# Types
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

/// Export response
#[derive(Debug, Serialize)]
pub struct ExportResponse {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub message: String,
    pub format: String,
    pub record_count: usize,
}

// ============================================
# Endpoint Handlers
// ============================================

/// Export waste data
/// 
/// GET /api/export/waste
/// Query: format=csv|json, start_date, end_date, limit
pub async fn export_waste(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    query: Query<ExportQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let user_id = auth.user_id;
    let params = query.0;
    
    info!(user_id = %user_id, format = ?params.format, "Exporting waste data");
    
    // Validate format
    match params.format {
        ExportFormat::Csv | ExportFormat::Json => {
            // Valid format - proceed
        }
    }
    
    // Fetch data
    let data = ExportService::export_waste_data(&state.db, &user_id, params.start_date, params.end_date, params.limit).await?;
    
    // Format response
    let response = match params.format {
        ExportFormat::Csv => {
            let csv_data = ExportService::to_csv(data)?;
            ExportResponse {
                success: true,
                data: Some(serde_json::json!({ "csv": csv_data })),
                message: "Waste data exported successfully".to_string(),
                format: "csv".to_string(),
                record_count: csv_data.len(),
            }
        }
        ExportFormat::Json => {
            ExportResponse {
                success: true,
                data: Some(serde_json::to_value(data)?),
                message: "Waste data exported successfully".to_string(),
                format: "json".to_string(),
                record_count: data.len(),
            }
        }
    };
    
    Ok(Json(response))
}

/// Export user data
/// 
/// GET /api/export/users
/// Query: format=csv|json
pub async fn export_users(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    query: Query<ExportQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let user_id = auth.user_id;
    let params = query.0;
    
    info!(user_id = %user_id, format = ?params.format, "Exporting user data");
    
    // Only admin users can export all users
    let is_admin = auth.is_admin.unwrap_or(false);
    if !is_admin {
        warn!(user_id = %user_id, "Non-admin user attempted to export all users");
        return Err(ApiError::Unauthorized("Admin access required".to_string()));
    }
    
    let data = ExportService::export_user_data(&state.db, params.start_date, params.end_date, params.limit).await?;
    
    let response = match params.format {
        ExportFormat::Csv => {
            let csv_data = ExportService::to_csv(data)?;
            ExportResponse {
                success: true,
                data: Some(serde_json::json!({ "csv": csv_data })),
                message: "User data exported successfully".to_string(),
                format: "csv".to_string(),
                record_count: csv_data.len(),
            }
        }
        ExportFormat::Json => {
            ExportResponse {
                success: true,
                data: Some(serde_json::to_value(data)?),
                message: "User data exported successfully".to_string(),
                format: "json".to_string(),
                record_count: data.len(),
            }
        }
    };
    
    Ok(Json(response))
}

/// Export analytics data
/// 
/// GET /api/export/analytics
/// Query: format=csv|json
pub async fn export_analytics(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    query: Query<ExportQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let user_id = auth.user_id;
    let params = query.0;
    
    info!(user_id = %user_id, format = ?params.format, "Exporting analytics data");
    
    let is_admin = auth.is_admin.unwrap_or(false);
    if !is_admin {
        warn!(user_id = %user_id, "Non-admin user attempted to export analytics");
        return Err(ApiError::Unauthorized("Admin access required".to_string()));
    }
    
    let data = ExportService::export_analytics_data(&state.db, params.start_date, params.end_date).await?;
    
    let response = match params.format {
        ExportFormat::Csv => {
            let csv_data = ExportService::to_csv(data)?;
            ExportResponse {
                success: true,
                data: Some(serde_json::json!({ "csv": csv_data })),
                message: "Analytics data exported successfully".to_string(),
                format: "csv".to_string(),
                record_count: csv_data.len(),
            }
        }
        ExportFormat::Json => {
            ExportResponse {
                success: true,
                data: Some(serde_json::to_value(data)?),
                message: "Analytics data exported successfully".to_string(),
                format: "json".to_string(),
                record_count: data.len(),
            }
        }
    };
    
    Ok(Json(response))
}

// ============================================
# Route Registration
// ============================================

/// Get all export routes
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/export/waste", axum::routing::get(export_waste))
        .route("/export/users", axum::routing::get(export_users))
        .route("/export/analytics", axum::routing::get(export_analytics))
}

// ============================================
# Changelog
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
/// ## Kept (Active)
/// - `GET /api/export/waste` - CSV and JSON formats
/// - `GET /api/export/users` - CSV and JSON formats (admin only)
/// - `GET /api/export/analytics` - CSV and JSON formats (admin only)
/// 
/// ## Migration
/// Clients should migrate to the active endpoints:
/// - Use `format=csv` for CSV data
/// - Use `format=json` for JSON data
/// 
/// ## Date
/// 2024-01-15: Legacy endpoints removed
///

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
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
            success: true,
            data: Some(json!({ "test": "data" })),
            message: "Test message".to_string(),
            format: "csv".to_string(),
            record_count: 10,
        };
        let json = serde_json::to_value(&response).unwrap();
        assert!(json.get("success").is_some());
        assert!(json.get("data").is_some());
        assert!(json.get("message").is_some());
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
}
