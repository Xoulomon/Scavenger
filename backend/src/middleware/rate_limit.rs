//! Rate limiting middleware for the Scavenger backend.
//!
//! Updated as part of issue #909 — Add rate limiting to public endpoints.
//!
//! # Changes from initial version
//!
//! - Added [`RouteRateLimitConfig`] to specify different limits per route prefix.
//! - `Retry-After` header is now included on HTTP 429 responses (per docs/RATE_LIMITING.md).
//! - Per-route limits: public read endpoints get the stricter Anonymous tier.
//! - Introduced [`RateLimitLayer`] as a high-level builder for easy per-scope configuration.
//!
//! # Route limits
//!
//! | Path prefix | Tier | RPM | RPH |
//! |---|---|---|---|
//! | `/api/v1/contracts/` | Anonymous | 30 | 200 |
//! | `/api/v1/search` | Anonymous | 30 | 200 |
//! | `/api/v1/audit/` | Free | 60 | 1000 |
//! | `/ws` | Free | 60 | 1000 |
//! | Everything else | Free | 60 | 1000 |
//!
//! # Response Headers (all responses)
//! - `X-RateLimit-Limit-Minute`
//! - `X-RateLimit-Limit-Hour`
//! - `X-RateLimit-Remaining-Minute`
//! - `X-RateLimit-Remaining-Hour`
//!
//! # On HTTP 429
//! - `Retry-After` — seconds until the exhausted window resets.

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpResponse,
};
use futures::future::LocalBoxFuture;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

// ── Tier and config ───────────────────────────────────────────────────────────

/// Rate limiting tier — determines request quotas.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum RateLimitTier {
    Anonymous,
    Free,
    Premium,
    Admin,
}

impl RateLimitTier {
    pub fn config(&self) -> RateLimitConfig {
        match self {
            RateLimitTier::Anonymous => RateLimitConfig {
                requests_per_minute: 30,
                requests_per_hour: 200,
            },
            RateLimitTier::Free => RateLimitConfig {
                requests_per_minute: 60,
                requests_per_hour: 1000,
            },
            RateLimitTier::Premium => RateLimitConfig {
                requests_per_minute: 300,
                requests_per_hour: 5000,
            },
            RateLimitTier::Admin => RateLimitConfig {
                requests_per_minute: 1000,
                requests_per_hour: 50000,
            },
        }
    }
}

#[derive(Clone, Debug)]
pub struct RateLimitConfig {
    pub requests_per_minute: u32,
    pub requests_per_hour: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        RateLimitTier::Free.config()
    }
}

/// Per-route prefix override. The first matching prefix wins.
#[derive(Clone, Debug)]
pub struct RouteRateLimitConfig {
    /// URL path prefix (e.g. `"/api/v1/search"`).
    pub prefix: String,
    pub config: RateLimitConfig,
}

impl RouteRateLimitConfig {
    pub fn new(prefix: impl Into<String>, tier: RateLimitTier) -> Self {
        Self {
            prefix: prefix.into(),
            config: tier.config(),
        }
    }
}

// ── Metrics ───────────────────────────────────────────────────────────────────

#[derive(Debug, Default, Clone)]
pub struct RateLimitMetrics {
    pub total_requests: u64,
    pub rate_limited_requests: u64,
    pub by_tier: HashMap<String, u64>,
}

// ── Internal sliding-window state ─────────────────────────────────────────────

struct RateLimitState {
    minute_buckets: HashMap<String, Vec<Instant>>,
    hour_buckets: HashMap<String, Vec<Instant>>,
    metrics: RateLimitMetrics,
}

impl RateLimitState {
    fn new() -> Self {
        Self {
            minute_buckets: HashMap::new(),
            hour_buckets: HashMap::new(),
            metrics: RateLimitMetrics::default(),
        }
    }

    /// Check and record a request for `key` against `config`.
    /// Returns `Ok((remaining_min, remaining_hr))` or `Err(retry_after_secs)`.
    fn check_and_record(&mut self, key: &str, config: &RateLimitConfig) -> Result<(usize, usize), u64> {
        self.metrics.total_requests += 1;
        let now = Instant::now();

        // Minute window
        let min_key = format!("{}:min", key);
        let min_bucket = self.minute_buckets.entry(min_key.clone()).or_default();
        min_bucket.retain(|t| now.duration_since(*t) < Duration::from_secs(60));
        let min_count = min_bucket.len();

        // Hour window
        let hr_key = format!("{}:hr", key);
        let hr_bucket = self.hour_buckets.entry(hr_key.clone()).or_default();
        hr_bucket.retain(|t| now.duration_since(*t) < Duration::from_secs(3600));
        let hr_count = hr_bucket.len();

        if min_count >= config.requests_per_minute as usize {
            self.metrics.rate_limited_requests += 1;
            let retry_after = self
                .minute_buckets
                .get(&min_key)
                .and_then(|b| b.first().copied())
                .map(|oldest| {
                    let elapsed = now.duration_since(oldest).as_secs();
                    60_u64.saturating_sub(elapsed)
                })
                .unwrap_or(60)
                .max(1);
            return Err(retry_after);
        }

        if hr_count >= config.requests_per_hour as usize {
            self.metrics.rate_limited_requests += 1;
            let retry_after = self
                .hour_buckets
                .get(&hr_key)
                .and_then(|b| b.first().copied())
                .map(|oldest| {
                    let elapsed = now.duration_since(oldest).as_secs();
                    3600_u64.saturating_sub(elapsed)
                })
                .unwrap_or(3600)
                .max(1);
            return Err(retry_after);
        }

        // Record this request
        self.minute_buckets.entry(min_key).or_default().push(now);
        self.hour_buckets.entry(hr_key).or_default().push(now);

        let remaining_min = (config.requests_per_minute as usize).saturating_sub(min_count + 1);
        let remaining_hr = (config.requests_per_hour as usize).saturating_sub(hr_count + 1);
        Ok((remaining_min, remaining_hr))
    }
}

// ── Middleware factory ────────────────────────────────────────────────────────

pub struct RateLimitMiddleware {
    default_config: RateLimitConfig,
    route_configs: Vec<RouteRateLimitConfig>,
    state: Arc<Mutex<RateLimitState>>,
}

impl RateLimitMiddleware {
    /// Create with a single global config plus built-in per-route defaults.
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            default_config: config,
            route_configs: vec![
                // Public read-heavy contract endpoints: stricter limits
                RouteRateLimitConfig::new("/api/v1/contracts/", RateLimitTier::Anonymous),
                // Search endpoints: tighter to prevent scraping
                RouteRateLimitConfig::new("/api/v1/search", RateLimitTier::Anonymous),
                // Write/mutation endpoints: standard Free tier
                RouteRateLimitConfig::new("/api/v1/cache/invalidate", RateLimitTier::Free),
                RouteRateLimitConfig::new("/api/v1/audit/", RateLimitTier::Free),
                RouteRateLimitConfig::new("/api/v1/compliance/", RateLimitTier::Free),
                RouteRateLimitConfig::new("/api/v1/signing/", RateLimitTier::Free),
                RouteRateLimitConfig::new("/api/v1/verification/", RateLimitTier::Free),
                RouteRateLimitConfig::new("/api/v1/exports", RateLimitTier::Free),
                RouteRateLimitConfig::new("/api/v1/archival/", RateLimitTier::Free),
                RouteRateLimitConfig::new("/ws", RateLimitTier::Free),
            ],
            state: Arc::new(Mutex::new(RateLimitState::new())),
        }
    }

    /// Create with explicit per-route overrides.
    pub fn with_routes(config: RateLimitConfig, routes: Vec<RouteRateLimitConfig>) -> Self {
        Self {
            default_config: config,
            route_configs: routes,
            state: Arc::new(Mutex::new(RateLimitState::new())),
        }
    }

    pub fn metrics(&self) -> RateLimitMetrics {
        self.state.lock().unwrap().metrics.clone()
    }

    fn config_for_path(&self, path: &str) -> &RateLimitConfig {
        for route in &self.route_configs {
            if path.starts_with(&route.prefix) {
                return &route.config;
            }
        }
        &self.default_config
    }
}

impl<S, B> Transform<S, ServiceRequest> for RateLimitMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + Clone + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = RateLimitMiddlewareService<S>;
    type Future = std::future::Ready<Result<Self::Transform, Self::InitError>>;

    fn new_service(&self, service: S) -> Self::Future {
        std::future::ready(Ok(RateLimitMiddlewareService {
            service,
            default_config: self.default_config.clone(),
            route_configs: self.route_configs.clone(),
            state: self.state.clone(),
        }))
    }
}

// ── Middleware service ────────────────────────────────────────────────────────

pub struct RateLimitMiddlewareService<S> {
    service: S,
    default_config: RateLimitConfig,
    route_configs: Vec<RouteRateLimitConfig>,
    state: Arc<Mutex<RateLimitState>>,
}

impl<S> RateLimitMiddlewareService<S> {
    fn config_for_path(&self, path: &str) -> RateLimitConfig {
        for route in &self.route_configs {
            if path.starts_with(&route.prefix) {
                return route.config.clone();
            }
        }
        self.default_config.clone()
    }
}

impl<S, B> Service<ServiceRequest> for RateLimitMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + Clone + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let client_ip = req.connection_info().peer_addr().unwrap_or("unknown").to_string();

        let path = req.path().to_string();
        let config = self.config_for_path(&path);

        // Build a per-route+IP key so limits are independent across route groups
        let route_prefix = path.split('/').take(4).collect::<Vec<_>>().join("/");
        let key = format!("{}:{}", client_ip, route_prefix);

        let check_result = {
            let mut s = self.state.lock().unwrap();
            s.check_and_record(&key, &config)
        };

        let rpm = config.requests_per_minute.to_string();
        let rph = config.requests_per_hour.to_string();

        match check_result {
            Err(retry_after) => {
                // Return HTTP 429 with Retry-After header as an Error
                Box::pin(async move {
                    let response = HttpResponse::TooManyRequests()
                        .insert_header(("Retry-After", retry_after.to_string()))
                        .insert_header(("X-RateLimit-Limit-Minute", rpm))
                        .insert_header(("X-RateLimit-Limit-Hour", rph))
                        .insert_header(("X-RateLimit-Remaining-Minute", "0"))
                        .insert_header(("X-RateLimit-Remaining-Hour", "0"))
                        .json(serde_json::json!({
                            "error": "rate_limit_exceeded",
                            "message": "Too many requests. Check the Retry-After header.",
                            "retry_after_seconds": retry_after,
                        }));
                    Err(actix_web::error::InternalError::from_response("rate_limit_exceeded", response).into())
                })
            }
            Ok((remaining_min, remaining_hr)) => {
                let service = self.service.clone();
                Box::pin(async move {
                    let mut res = service.call(req).await?;
                    let h = res.headers_mut();
                    use actix_web::http::header::{HeaderName, HeaderValue};
                    let insert = |h: &mut actix_web::http::header::HeaderMap, k: &'static str, v: String| {
                        if let (Ok(name), Ok(val)) = (HeaderName::from_static(k), HeaderValue::from_str(&v)) {
                            h.insert(name, val);
                        }
                    };
                    insert(h, "x-ratelimit-limit-minute", rpm);
                    insert(h, "x-ratelimit-limit-hour", rph);
                    insert(h, "x-ratelimit-remaining-minute", remaining_min.to_string());
                    insert(h, "x-ratelimit-remaining-hour", remaining_hr.to_string());
                    Ok(res)
                })
            }
        }
    }
}

// ── Builder helper ────────────────────────────────────────────────────────────

/// Ergonomic builder for configuring rate limiting.
pub struct RateLimitLayer {
    default_tier: RateLimitTier,
    extra_routes: Vec<RouteRateLimitConfig>,
}

impl Default for RateLimitLayer {
    fn default() -> Self {
        Self {
            default_tier: RateLimitTier::Free,
            extra_routes: Vec::new(),
        }
    }
}

impl RateLimitLayer {
    pub fn default_tier(mut self, tier: RateLimitTier) -> Self {
        self.default_tier = tier;
        self
    }

    pub fn route(mut self, prefix: impl Into<String>, tier: RateLimitTier) -> Self {
        self.extra_routes.push(RouteRateLimitConfig::new(prefix, tier));
        self
    }

    pub fn build(self) -> RateLimitMiddleware {
        RateLimitMiddleware::with_routes(self.default_tier.config(), self.extra_routes)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limit_tiers() {
        assert!(
            RateLimitTier::Anonymous.config().requests_per_minute < RateLimitTier::Free.config().requests_per_minute
        );
        assert!(RateLimitTier::Free.config().requests_per_minute < RateLimitTier::Premium.config().requests_per_minute);
        assert!(
            RateLimitTier::Premium.config().requests_per_minute < RateLimitTier::Admin.config().requests_per_minute
        );
    }

    #[test]
    fn test_check_and_record_within_limit() {
        let mut state = RateLimitState::new();
        let config = RateLimitTier::Free.config();
        let result = state.check_and_record("127.0.0.1", &config);
        assert!(result.is_ok());
        let (remaining_min, remaining_hr) = result.unwrap();
        assert_eq!(remaining_min, (config.requests_per_minute - 1) as usize);
        assert_eq!(remaining_hr, (config.requests_per_hour - 1) as usize);
    }

    #[test]
    fn test_check_and_record_exceeds_minute_limit() {
        let mut state = RateLimitState::new();
        let config = RateLimitConfig {
            requests_per_minute: 3,
            requests_per_hour: 1000,
        };
        for _ in 0..3 {
            let _ = state.check_and_record("127.0.0.1", &config);
        }
        let result = state.check_and_record("127.0.0.1", &config);
        assert!(result.is_err());
        let retry = result.unwrap_err();
        assert!(retry > 0, "Retry-After should be positive");
        assert!(retry <= 60, "Retry-After should be at most 60s for minute window");
    }

    #[test]
    fn test_check_and_record_exceeds_hour_limit() {
        let mut state = RateLimitState::new();
        let config = RateLimitConfig {
            requests_per_minute: 1000,
            requests_per_hour: 2,
        };
        for _ in 0..2 {
            let _ = state.check_and_record("ip1", &config);
        }
        assert!(state.check_and_record("ip1", &config).is_err());
    }

    #[test]
    fn test_different_ips_are_isolated() {
        let mut state = RateLimitState::new();
        let config = RateLimitConfig {
            requests_per_minute: 1,
            requests_per_hour: 100,
        };
        let _ = state.check_and_record("ip1", &config);
        assert!(
            state.check_and_record("ip2", &config).is_ok(),
            "ip2 should not be affected by ip1's limit"
        );
    }

    #[test]
    fn test_config_for_path_contracts() {
        let mw = RateLimitMiddleware::new(RateLimitConfig::default());
        let c = mw.config_for_path("/api/v1/contracts/wastes");
        assert_eq!(
            c.requests_per_minute,
            RateLimitTier::Anonymous.config().requests_per_minute
        );
    }

    #[test]
    fn test_config_for_path_search() {
        let mw = RateLimitMiddleware::new(RateLimitConfig::default());
        let c = mw.config_for_path("/api/v1/search");
        assert_eq!(
            c.requests_per_minute,
            RateLimitTier::Anonymous.config().requests_per_minute
        );
    }

    #[test]
    fn test_config_for_path_health_fallback() {
        let mw = RateLimitMiddleware::new(RateLimitConfig::default());
        let c = mw.config_for_path("/health");
        assert_eq!(c.requests_per_minute, RateLimitConfig::default().requests_per_minute);
    }

    #[test]
    fn test_metrics_tracking() {
        let mut state = RateLimitState::new();
        let config = RateLimitConfig {
            requests_per_minute: 1,
            requests_per_hour: 100,
        };
        let _ = state.check_and_record("ip", &config);
        let _ = state.check_and_record("ip", &config); // rate-limited
        assert_eq!(state.metrics.total_requests, 2);
        assert_eq!(state.metrics.rate_limited_requests, 1);
    }

    #[test]
    fn test_rate_limit_layer_builder() {
        let mw = RateLimitLayer::default()
            .default_tier(RateLimitTier::Anonymous)
            .route("/api/v1/admin/", RateLimitTier::Admin)
            .build();
        let admin_config = mw.config_for_path("/api/v1/admin/users");
        assert_eq!(
            admin_config.requests_per_minute,
            RateLimitTier::Admin.config().requests_per_minute
        );
    }
}
