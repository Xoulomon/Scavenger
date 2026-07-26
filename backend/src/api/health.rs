//! Liveness and readiness health-check endpoints.
//!
//! - `GET /healthz` — liveness probe: the process is up and running.
//! - `GET /readyz`  — readiness probe: all required dependencies are reachable.
//!
//! Both endpoints return a JSON body with a per-dependency status so that
//! operators and load balancers get actionable diagnostics.
//!
//! # Response shape
//!
//! ```json
//! {
//!   "status": "healthy",           // "healthy" | "degraded" | "unhealthy"
//!   "version": "1.0.0",
//!   "timestamp": "2026-01-01T00:00:00Z",
//!   "checks": {
//!     "database": { "status": "ok",   "latency_ms": 3  },
//!     "rpc":      { "status": "ok",   "latency_ms": 12 }
//!   }
//! }
//! ```
//!
//! HTTP status codes:
//! - `200 OK`             — all checks pass.
//! - `503 Service Unavailable` — one or more checks fail (readiness only).

use actix_web::{web, HttpResponse};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

use crate::config::AppConfig;

// ── Types ─────────────────────────────────────────────────────────────────────

/// Status of a single dependency check.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CheckStatus {
    Ok,
    Degraded,
    Unhealthy,
}

impl CheckStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            CheckStatus::Ok => "ok",
            CheckStatus::Degraded => "degraded",
            CheckStatus::Unhealthy => "unhealthy",
        }
    }
}

/// Result of a single dependency check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    pub status: CheckStatus,
    /// Round-trip latency in milliseconds (None if check was skipped/failed instantly).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    /// Human-readable detail, especially on failure.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl CheckResult {
    fn ok(latency_ms: u64) -> Self {
        CheckResult {
            status: CheckStatus::Ok,
            latency_ms: Some(latency_ms),
            message: None,
        }
    }

    fn unhealthy(message: impl Into<String>) -> Self {
        CheckResult {
            status: CheckStatus::Unhealthy,
            latency_ms: None,
            message: Some(message.into()),
        }
    }
}

/// Overall health response body.
#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    /// Aggregate status derived from individual check results.
    pub status: String,
    pub version: &'static str,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checks: Option<HashMap<String, CheckResult>>,
}

// ── Liveness probe ────────────────────────────────────────────────────────────

/// `GET /healthz`
///
/// Liveness probe — always returns `200 OK` as long as the process is running.
/// Does **not** perform dependency checks so that a slow dependency cannot
/// cause the container orchestrator to restart a healthy process.
pub async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION"),
        timestamp: Utc::now().to_rfc3339(),
        checks: None,
    })
}

// ── Readiness probe ───────────────────────────────────────────────────────────

/// `GET /readyz`
///
/// Readiness probe — checks all required dependencies.
/// Returns `200 OK` when all pass, `503 Service Unavailable` otherwise.
pub async fn readyz(config: web::Data<AppConfig>) -> HttpResponse {
    let mut checks = HashMap::new();

    // Database connectivity check
    checks.insert("database".to_string(), check_database(&config.database.url).await);

    // RPC / Stellar horizon check
    checks.insert("rpc".to_string(), check_rpc().await);

    let all_healthy = checks.values().all(|c| c.status == CheckStatus::Ok);
    let has_degraded = checks.values().any(|c| c.status == CheckStatus::Degraded);

    let overall = if all_healthy {
        "healthy"
    } else if has_degraded {
        "degraded"
    } else {
        "unhealthy"
    };

    let body = HealthResponse {
        status: overall.to_string(),
        version: env!("CARGO_PKG_VERSION"),
        timestamp: Utc::now().to_rfc3339(),
        checks: Some(checks),
    };

    if all_healthy || has_degraded {
        HttpResponse::Ok().json(body)
    } else {
        HttpResponse::ServiceUnavailable().json(body)
    }
}

// ── Dependency checks ─────────────────────────────────────────────────────────

/// Check database connectivity by attempting a TCP connection to the host/port
/// extracted from the DATABASE_URL.  A full connection pool is not available at
/// this layer, so we use a lightweight TCP handshake as a proxy for reachability.
async fn check_database(db_url: &str) -> CheckResult {
    // Parse host:port from a postgres URL like postgres://user:pass@host:port/db
    let host_port = parse_db_host_port(db_url);

    match host_port {
        None => CheckResult::unhealthy("unable to parse DATABASE_URL"),
        Some(addr) => {
            let start = Instant::now();
            match tokio::net::TcpStream::connect(&addr).await {
                Ok(_) => CheckResult::ok(start.elapsed().as_millis() as u64),
                Err(e) => CheckResult::unhealthy(format!("TCP connect failed: {e}")),
            }
        }
    }
}

/// Extract `host:port` from a Postgres connection URL.
/// Falls back to port 5432 if no explicit port is given.
fn parse_db_host_port(url: &str) -> Option<String> {
    // Strip scheme
    let without_scheme = url
        .strip_prefix("postgres://")
        .or_else(|| url.strip_prefix("postgresql://"))?;

    // Strip user:pass@ prefix
    let host_part = if let Some(at) = without_scheme.find('@') {
        &without_scheme[at + 1..]
    } else {
        without_scheme
    };

    // Strip /dbname suffix
    let host_and_port = host_part.split('/').next()?;

    // If port already included, use as-is; otherwise append default
    if host_and_port.contains(':') {
        Some(host_and_port.to_string())
    } else {
        Some(format!("{}:5432", host_and_port))
    }
}

/// Check RPC / Stellar Horizon reachability.
///
/// In the current architecture the backend does not have a direct live
/// connection to Horizon, so we check the known public testnet endpoint
/// with a short timeout.  When `HORIZON_URL` is set in the environment
/// that value is used instead.
async fn check_rpc() -> CheckResult {
    let horizon_url = std::env::var("HORIZON_URL")
        .unwrap_or_else(|_| "https://horizon-testnet.stellar.org".to_string());

    let url = format!("{}/", horizon_url.trim_end_matches('/'));

    let start = Instant::now();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build();

    match client {
        Err(e) => CheckResult::unhealthy(format!("failed to build HTTP client: {e}")),
        Ok(client) => match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() || resp.status().as_u16() == 200 => {
                CheckResult::ok(start.elapsed().as_millis() as u64)
            }
            Ok(resp) => CheckResult::unhealthy(format!("RPC returned HTTP {}", resp.status())),
            Err(e) => CheckResult::unhealthy(format!("RPC unreachable: {e}")),
        },
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, web, App};

    use crate::config::{
        AppConfig, DatabaseConfig, LogConfig, SecurityConfig, ServerConfig, ServicesConfig,
        StorageConfig,
    };

    fn test_config() -> AppConfig {
        AppConfig {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 8080,
                allowed_origins: "http://localhost:3000".to_string(),
            },
            database: DatabaseConfig {
                // intentionally unreachable so DB check fails
                url: "postgres://user:pass@127.0.0.1:15432/testdb".to_string(),
            },
            log: LogConfig {
                level: "info".to_string(),
                format: "pretty".to_string(),
            },
            services: ServicesConfig {
                sendgrid_api_key: None,
                from_email: "test@example.com".to_string(),
                firebase_project_id: None,
                s3_bucket: None,
                aws_region: "us-east-1".to_string(),
                elasticsearch_url: "http://localhost:9200".to_string(),
                elasticsearch_username: None,
                elasticsearch_password: None,
            },
            security: SecurityConfig {
                csrf_secret: "test-secret".to_string(),
            },
            storage: StorageConfig {
                storage_path: "/tmp".to_string(),
                archival_storage_path: "/tmp/archives".to_string(),
            },
        }
    }

    // ── /healthz tests ────────────────────────────────────────────────────────

    #[actix_web::test]
    async fn test_healthz_returns_200() {
        let app = test::init_service(App::new().route("/healthz", web::get().to(healthz))).await;
        let req = test::TestRequest::get().uri("/healthz").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_healthz_body_has_healthy_status() {
        let app = test::init_service(App::new().route("/healthz", web::get().to(healthz))).await;
        let req = test::TestRequest::get().uri("/healthz").to_request();
        let body: HealthResponse = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body.status, "healthy");
        assert!(body.checks.is_none(), "liveness should not include dependency checks");
    }

    #[actix_web::test]
    async fn test_healthz_body_has_version_and_timestamp() {
        let app = test::init_service(App::new().route("/healthz", web::get().to(healthz))).await;
        let req = test::TestRequest::get().uri("/healthz").to_request();
        let body: HealthResponse = test::call_and_read_body_json(&app, req).await;
        assert!(!body.version.is_empty());
        assert!(!body.timestamp.is_empty());
    }

    // ── /readyz tests ─────────────────────────────────────────────────────────

    #[actix_web::test]
    async fn test_readyz_returns_json_with_checks() {
        let config = test_config();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(config))
                .route("/readyz", web::get().to(readyz)),
        )
        .await;
        let req = test::TestRequest::get().uri("/readyz").to_request();
        let body: HealthResponse = test::call_and_read_body_json(&app, req).await;
        let checks = body.checks.expect("readiness should include checks");
        assert!(checks.contains_key("database"), "should have a 'database' check");
        assert!(checks.contains_key("rpc"), "should have an 'rpc' check");
    }

    #[actix_web::test]
    async fn test_readyz_returns_503_when_db_unreachable() {
        let config = test_config(); // DB points to unreachable port 15432
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(config))
                .route("/readyz", web::get().to(readyz)),
        )
        .await;
        let req = test::TestRequest::get().uri("/readyz").to_request();
        let resp = test::call_service(&app, req).await;
        // When DB is down the overall status should be unhealthy → 503
        assert_eq!(resp.status(), actix_web::http::StatusCode::SERVICE_UNAVAILABLE);
    }

    // ── parse_db_host_port unit tests ─────────────────────────────────────────

    #[test]
    fn test_parse_db_host_port_full_url() {
        assert_eq!(
            parse_db_host_port("postgres://user:pass@db.example.com:5433/mydb"),
            Some("db.example.com:5433".to_string())
        );
    }

    #[test]
    fn test_parse_db_host_port_no_port() {
        assert_eq!(
            parse_db_host_port("postgres://user:pass@db.example.com/mydb"),
            Some("db.example.com:5432".to_string())
        );
    }

    #[test]
    fn test_parse_db_host_port_no_credentials() {
        assert_eq!(
            parse_db_host_port("postgres://localhost/mydb"),
            Some("localhost:5432".to_string())
        );
    }

    #[test]
    fn test_parse_db_host_port_invalid_scheme() {
        assert_eq!(parse_db_host_port("mysql://localhost/db"), None);
    }

    // ── CheckResult helpers ───────────────────────────────────────────────────

    #[test]
    fn test_check_result_ok() {
        let r = CheckResult::ok(5);
        assert_eq!(r.status, CheckStatus::Ok);
        assert_eq!(r.latency_ms, Some(5));
        assert!(r.message.is_none());
    }

    #[test]
    fn test_check_result_unhealthy() {
        let r = CheckResult::unhealthy("connection refused");
        assert_eq!(r.status, CheckStatus::Unhealthy);
        assert!(r.latency_ms.is_none());
        assert_eq!(r.message.as_deref(), Some("connection refused"));
    }
}
