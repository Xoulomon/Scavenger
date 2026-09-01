use actix_web::{web, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use crate::services::{
    ArchivalService, RetentionPolicy, ArchiveQuery, ArchiveStatus, StorageTier,
};
use std::sync::Arc;

/// API handlers for data archival

/// Create retention policy
pub async fn create_policy(
    service: web::Data<Arc<ArchivalService>>,
    policy: web::Json<RetentionPolicy>,
) -> Result<HttpResponse> {
    let policy_id = service.create_policy(policy.into_inner())
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "policy_id": policy_id,
        "message": "Retention policy created successfully"
    })))
}

/// Get retention policy
pub async fn get_policy(
    service: web::Data<Arc<ArchivalService>>,
    policy_id: web::Path<String>,
) -> Result<HttpResponse> {
    let policy = service.get_policy(&policy_id)
        .map_err(actix_web::error::ErrorNotFound)?;

    Ok(HttpResponse::Ok().json(policy))
}

/// List all retention policies
pub async fn list_policies(
    service: web::Data<Arc<ArchivalService>>,
) -> Result<HttpResponse> {
    let policies = service.list_policies()
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().json(policies))
}

/// Update retention policy
pub async fn update_policy(
    service: web::Data<Arc<ArchivalService>>,
    policy_id: web::Path<String>,
    policy: web::Json<RetentionPolicy>,
) -> Result<HttpResponse> {
    service.update_policy(&policy_id, policy.into_inner())
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Policy updated successfully"
    })))
}

/// Delete retention policy
pub async fn delete_policy(
    service: web::Data<Arc<ArchivalService>>,
    policy_id: web::Path<String>,
) -> Result<HttpResponse> {
    service.delete_policy(&policy_id)
        .map_err(actix_web::error::ErrorNotFound)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Policy deleted successfully"
    })))
}

/// Query archives
#[derive(Debug, Deserialize)]
pub struct QueryParams {
    data_type: Option<String>,
    status: Option<String>,
    from_date: Option<String>,
    to_date: Option<String>,
    storage_tier: Option<String>,
    #[serde(default = "default_limit")]
    limit: usize,
    #[serde(default)]
    offset: usize,
}

fn default_limit() -> usize {
    100
}

pub async fn query_archives(
    service: web::Data<Arc<ArchivalService>>,
    params: web::Query<QueryParams>,
) -> Result<HttpResponse> {
    use chrono::DateTime;

    let query = ArchiveQuery {
        data_type: params.data_type.clone(),
        status: params.status.as_ref().and_then(|s| {
            match s.as_str() {
                "pending" => Some(ArchiveStatus::Pending),
                "in_progress" => Some(ArchiveStatus::InProgress),
                "completed" => Some(ArchiveStatus::Completed),
                "failed" => Some(ArchiveStatus::Failed),
                "restored" => Some(ArchiveStatus::Restored),
                _ => None,
            }
        }),
        from_date: params.from_date.as_ref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc)),
        to_date: params.to_date.as_ref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc)),
        storage_tier: params.storage_tier.as_ref().and_then(|s| {
            match s.as_str() {
                "hot" => Some(StorageTier::Hot),
                "warm" => Some(StorageTier::Warm),
                "cold" => Some(StorageTier::Cold),
                "glacier" => Some(StorageTier::Glacier),
                _ => None,
            }
        }),
        limit: params.limit,
        offset: params.offset,
    };

    let archives = service.query_archives(query)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().json(archives))
}

/// Get archive statistics
pub async fn get_statistics(
    service: web::Data<Arc<ArchivalService>>,
) -> Result<HttpResponse> {
    let stats = service.get_statistics()
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().json(stats))
}

/// Archive data request
#[derive(Debug, Deserialize)]
pub struct ArchiveRequest {
    pub data_type: String,
    pub data_id: String,
    pub policy_id: String,
    #[serde(with = "base64_serde")]
    pub data: Vec<u8>,
}

mod base64_serde {
    use serde::{Deserialize, Deserializer, Serializer};
    use base64::{Engine as _, engine::general_purpose};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&general_purpose::STANDARD.encode(bytes))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s: String = Deserialize::deserialize(deserializer)?;
        general_purpose::STANDARD.decode(s).map_err(serde::de::Error::custom)
    }
}

/// Archive data
pub async fn archive_data(
    service: web::Data<Arc<ArchivalService>>,
    request: web::Json<ArchiveRequest>,
) -> Result<HttpResponse> {
    let req = request.into_inner();

    let archive_id = service.archive_data(
        req.data_type,
        req.data_id,
        req.data,
        req.policy_id,
    ).await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "archive_id": archive_id,
        "message": "Data archived successfully"
    })))
}

/// Restore archived data
pub async fn restore_data(
    service: web::Data<Arc<ArchivalService>>,
    archive_id: web::Path<String>,
) -> Result<HttpResponse> {
    let data = service.restore_data(&archive_id).await
        .map_err(actix_web::error::ErrorNotFound)?;

    use base64::{Engine as _, engine::general_purpose};
    let encoded = general_purpose::STANDARD.encode(&data);

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "archive_id": archive_id.as_str(),
        "data": encoded,
        "size": data.len()
    })))
}

/// Delete archived data
pub async fn delete_archive(
    service: web::Data<Arc<ArchivalService>>,
    archive_id: web::Path<String>,
) -> Result<HttpResponse> {
    service.delete_archive(&archive_id).await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Archive deleted successfully"
    })))
}

/// List archive jobs
pub async fn list_jobs(
    service: web::Data<Arc<ArchivalService>>,
    status: web::Query<Option<String>>,
) -> Result<HttpResponse> {
    let filter_status = status.0.as_ref().and_then(|s| {
        match s.as_str() {
            "pending" => Some(ArchiveStatus::Pending),
            "in_progress" => Some(ArchiveStatus::InProgress),
            "completed" => Some(ArchiveStatus::Completed),
            "failed" => Some(ArchiveStatus::Failed),
            _ => None,
        }
    });

    let jobs = service.list_jobs(filter_status)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().json(jobs))
}

/// Get archive job
pub async fn get_job(
    service: web::Data<Arc<ArchivalService>>,
    job_id: web::Path<String>,
) -> Result<HttpResponse> {
    let job = service.get_job(&job_id)
        .map_err(actix_web::error::ErrorNotFound)?;

    Ok(HttpResponse::Ok().json(job))
}
