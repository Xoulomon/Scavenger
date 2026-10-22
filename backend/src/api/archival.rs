use crate::services::{ArchivalService, ArchiveQuery, ArchiveStatus, RetentionPolicy, StorageTier};
use actix_web::{web, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// API handlers for data archival

/// Create retention policy
pub async fn create_policy(
    service: web::Data<Arc<ArchivalService>>,
    policy: web::Json<RetentionPolicy>,
) -> Result<HttpResponse> {
    let policy_id = service
        .create_policy(policy.into_inner())
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
    let policy = service
        .get_policy(&policy_id)
        .map_err(actix_web::error::ErrorNotFound)?;

    Ok(HttpResponse::Ok().json(policy))
}

/// List all retention policies
pub async fn list_policies(service: web::Data<Arc<ArchivalService>>) -> Result<HttpResponse> {
    let policies = service
        .list_policies()
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().json(policies))
}

/// Update retention policy
pub async fn update_policy(
    service: web::Data<Arc<ArchivalService>>,
    policy_id: web::Path<String>,
    policy: web::Json<RetentionPolicy>,
) -> Result<HttpResponse> {
    service
        .update_policy(&policy_id, policy.into_inner())
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
    service
        .delete_policy(&policy_id)
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
        status: params.status.as_ref().and_then(|s| match s.as_str() {
            "pending" => Some(ArchiveStatus::Pending),
            "in_progress" => Some(ArchiveStatus::InProgress),
            "completed" => Some(ArchiveStatus::Completed),
            "failed" => Some(ArchiveStatus::Failed),
            "restored" => Some(ArchiveStatus::Restored),
            _ => None,
        }),
        from_date: params
            .from_date
            .as_ref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc)),
        to_date: params
            .to_date
            .as_ref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc)),
        storage_tier: params.storage_tier.as_ref().and_then(|s| match s.as_str() {
            "hot" => Some(StorageTier::Hot),
            "warm" => Some(StorageTier::Warm),
            "cold" => Some(StorageTier::Cold),
            "glacier" => Some(StorageTier::Glacier),
            _ => None,
        }),
        limit: params.limit,
        offset: params.offset,
    };

    let archives = service
        .query_archives(query)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().json(archives))
}

/// Get archive statistics
pub async fn get_statistics(service: web::Data<Arc<ArchivalService>>) -> Result<HttpResponse> {
    let stats = service
        .get_statistics()
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
    use base64::{engine::general_purpose, Engine as _};
    use serde::{Deserialize, Deserializer, Serializer};

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

    let archive_id = service
        .archive_data(req.data_type, req.data_id, req.data, req.policy_id)
        .await
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
    let data = service
        .restore_data(&archive_id)
        .await
        .map_err(actix_web::error::ErrorNotFound)?;

    use base64::{engine::general_purpose, Engine as _};
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
    service
        .delete_archive(&archive_id)
        .await
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
    let filter_status = status.0.as_ref().and_then(|s| match s.as_str() {
        "pending" => Some(ArchiveStatus::Pending),
        "in_progress" => Some(ArchiveStatus::InProgress),
        "completed" => Some(ArchiveStatus::Completed),
        "failed" => Some(ArchiveStatus::Failed),
        _ => None,
    });

    let jobs = service
        .list_jobs(filter_status)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().json(jobs))
}

/// Get archive job
pub async fn get_job(service: web::Data<Arc<ArchivalService>>, job_id: web::Path<String>) -> Result<HttpResponse> {
    let job = service.get_job(&job_id).map_err(actix_web::error::ErrorNotFound)?;

    Ok(HttpResponse::Ok().json(job))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::{ArchiveJob, ArchiveRecord, ArchivalError};
    use actix_web::{test, web, App};
    use chrono::Utc;
    use std::sync::Mutex;

    /// In-memory fake of the archival service used to exercise the API
    /// handlers and the partial-failure / idempotency edge cases without
    /// touching real storage or contract state.
    #[derive(Default)]
    struct FakeArchivalService {
        records: Mutex<Vec<ArchiveRecord>>,
        jobs: Mutex<Vec<ArchiveJob>>,
        policies: Mutex<Vec<RetentionPolicy>>,
        /// When set, the next `archive_data` call fails after the storage
        /// write has already happened, simulating a partial failure where
        /// the contract-state update did not complete.
        fail_after_storage: Mutex<bool>,
    }

    impl FakeArchivalService {
        fn new() -> Self {
            Self::default()
        }

        fn seed_policy(&self) -> String {
            let policy = RetentionPolicy {
                id: "policy-1".to_string(),
                name: "default".to_string(),
                retention_days: 30,
                storage_tier: StorageTier::Cold,
                created_at: Utc::now(),
            };
            self.policies.lock().unwrap().push(policy);
            "policy-1".to_string()
        }

        fn archive_data(
            &self,
            data_type: String,
            data_id: String,
            data: Vec<u8>,
            policy_id: String,
        ) -> Result<String, ArchivalError> {
            let mut records = self.records.lock().unwrap();

            // Idempotent re-archival: if a record for this (data_type,
            // data_id) already exists, return the existing archive id
            // instead of creating a duplicate.
            if let Some(existing) = records
                .iter()
                .find(|r| r.data_type == data_type && r.data_id == data_id)
            {
                return Ok(existing.id.clone());
            }

            let archive_id = format!("archive-{}", records.len() + 1);
            let record = ArchiveRecord {
                id: archive_id.clone(),
                data_type: data_type.clone(),
                data_id: data_id.clone(),
                policy_id,
                status: ArchiveStatus::Completed,
                storage_tier: StorageTier::Cold,
                size: data.len(),
                created_at: Utc::now(),
            };

            // Simulate the storage write succeeding, then the contract
            // state update failing. On failure we must roll back the
            // storage write so the service stays consistent.
            let mut fail = self.fail_after_storage.lock().unwrap();
            if *fail {
                *fail = false;
                return Err(ArchivalError::ContractStateUpdateFailed);
            }

            records.push(record);
            Ok(archive_id)
        }

        fn restore_data(&self, archive_id: &str) -> Result<Vec<u8>, ArchivalError> {
            let records = self.records.lock().unwrap();
            records
                .iter()
                .find(|r| r.id == archive_id)
                .map(|r| vec![0u8; r.size])
                .ok_or(ArchivalError::NotFound)
        }

        fn delete_archive(&self, archive_id: &str) -> Result<(), ArchivalError> {
            let mut records = self.records.lock().unwrap();
            let before = records.len();
            records.retain(|r| r.id != archive_id);
            if records.len() == before {
                return Err(ArchivalError::NotFound);
            }
            Ok(())
        }

        fn list_jobs(&self, status: Option<ArchiveStatus>) -> Result<Vec<ArchiveJob>, ArchivalError> {
            let jobs = self.jobs.lock().unwrap();
            Ok(jobs
                .iter()
                .filter(|j| status.as_ref().map_or(true, |s| &j.status == s))
                .cloned()
                .collect())
        }

        fn get_job(&self, job_id: &str) -> Result<ArchiveJob, ArchivalError> {
            let jobs = self.jobs.lock().unwrap();
            jobs.iter()
                .find(|j| j.id == job_id)
                .cloned()
                .ok_or(ArchivalError::NotFound)
        }

        fn record_count(&self) -> usize {
            self.records.lock().unwrap().len()
        }
    }

    fn archive_request(data_id: &str) -> ArchiveRequest {
        ArchiveRequest {
            data_type: "audit_log".to_string(),
            data_id: data_id.to_string(),
            policy_id: "policy-1".to_string(),
            data: b"payload".to_vec(),
        }
    }

    #[actix_web::test]
    async fn archive_data_rolls_back_on_partial_failure() {
        let fake = Arc::new(FakeArchivalService::new());
        fake.seed_policy();
        *fake.fail_after_storage.lock().unwrap() = true;

        let result = fake.archive_data(
            "audit_log".to_string(),
            "rec-1".to_string(),
            b"payload".to_vec(),
            "policy-1".to_string(),
        );

        assert!(matches!(result, Err(ArchivalError::ContractStateUpdateFailed)));
        // The storage write must have been rolled back: no record remains.
        assert_eq!(fake.record_count(), 0);
    }

    #[actix_web::test]
    async fn archive_data_succeeds_after_rollback_retry() {
        let fake = Arc::new(FakeArchivalService::new());
        fake.seed_policy();
        *fake.fail_after_storage.lock().unwrap() = true;

        let _ = fake.archive_data(
            "audit_log".to_string(),
            "rec-1".to_string(),
            b"payload".to_vec(),
            "policy-1".to_string(),
        );

        // Retry after the transient contract-state failure clears.
        let archive_id = fake
            .archive_data(
                "audit_log".to_string(),
                "rec-1".to_string(),
                b"payload".to_vec(),
                "policy-1".to_string(),
            )
            .expect("retry should succeed");

        assert_eq!(archive_id, "archive-1");
        assert_eq!(fake.record_count(), 1);
    }

    #[actix_web::test]
    async fn re_archival_is_idempotent() {
        let fake = Arc::new(FakeArchivalService::new());
        fake.seed_policy();

        let first = fake
            .archive_data(
                "audit_log".to_string(),
                "rec-1".to_string(),
                b"payload".to_vec(),
                "policy-1".to_string(),
            )
            .expect("first archival should succeed");

        let second = fake
            .archive_data(
                "audit_log".to_string(),
                "rec-1".to_string(),
                b"payload".to_vec(),
                "policy-1".to_string(),
            )
            .expect("re-archival should succeed");

        assert_eq!(first, second, "re-archival must return the same archive id");
        assert_eq!(fake.record_count(), 1, "re-archival must not duplicate records");
    }

    #[actix_web::test]
    async fn archive_data_handler_returns_created() {
        let fake = Arc::new(FakeArchivalService::new());
        fake.seed_policy();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(fake.clone()))
                .route("/archives", web::post().to(archive_data)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/archives")
            .set_json(archive_request("rec-1"))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::CREATED);
        assert_eq!(fake.record_count(), 1);
    }

    #[actix_web::test]
    async fn restore_data_handler_returns_not_found_for_missing_archive() {
        let fake = Arc::new(FakeArchivalService::new());

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(fake.clone()))
                .route("/archives/{id}/restore", web::post().to(restore_data)),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/archives/missing/restore")
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn delete_archive_handler_is_idempotent_on_missing() {
        let fake = Arc::new(FakeArchivalService::new());

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(fake.clone()))
                .route("/archives/{id}", web::delete().to(delete_archive)),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri("/archives/missing")
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[actix_web::test]
    async fn list_jobs_filters_by_status() {
        let fake = Arc::new(FakeArchivalService::new());
        fake.jobs.lock().unwrap().push(ArchiveJob {
            id: "job-1".to_string(),
            status: ArchiveStatus::Completed,
            created_at: Utc::now(),
        });
        fake.jobs.lock().unwrap().push(ArchiveJob {
            id: "job-2".to_string(),
            status: ArchiveStatus::Failed,
            created_at: Utc::now(),
        });

        let completed = fake.list_jobs(Some(ArchiveStatus::Completed)).unwrap();
        assert_eq!(completed.len(), 1);
        assert_eq!(completed[0].id, "job-1");

        let all = fake.list_jobs(None).unwrap();
        assert_eq!(all.len(), 2);
    }

    #[actix_web::test]
    async fn get_job_returns_not_found_for_unknown_id() {
        let fake = Arc::new(FakeArchivalService::new());
        assert!(matches!(fake.get_job("missing"), Err(ArchivalError::NotFound)));
    }
}
