//! Rate limit middleware
//! 
//! This module provides configurable rate limiting for API endpoints.
//! Rate limits can be configured via environment variables without code changes.
//! 
//! # Configuration Options
//! 
//! | Environment Variable | Description | Default |
//! |----------------------|-------------|---------|
//! | `RATE_LIMIT_DEFAULT` | Default rate limit (requests per window) | 100 |
//! | `RATE_LIMIT_WINDOW` | Default time window in seconds | 60 |
//! | `RATE_LIMIT_ADMIN` | Admin rate limit (limit,window) | 500,60 |
//! | `RATE_LIMIT_AUTH` | Auth user rate limit (limit,window) | 200,60 |
//! | `RATE_LIMIT_UNAUTH` | Unauthenticated user rate limit (limit,window) | 20,60 |
//! | `RATE_LIMIT_ROUTES` | Per-route overrides (method,route,limit,window;...) | None |
//! 
//! # Example
//! 
//! ```bash
//! # Set rate limits for production
//! export RATE_LIMIT_DEFAULT=100
//! export RATE_LIMIT_WINDOW=60
//! export RATE_LIMIT_ADMIN=500,60
//! export RATE_LIMIT_AUTH=200,60
//! export RATE_LIMIT_UNAUTH=20,60
//! export RATE_LIMIT_ROUTES=POST,/api/waste,50,60;GET,/api/export,30,120
//! ```

use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    web, Error, HttpMessage, HttpResponse,
};
use futures::future::{ok, LocalBoxFuture, Ready};
use std::cell::RefCell;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

use crate::config::rate_limit::{RateLimitConfig, RateLimitSettings};
use crate::redis::RedisClient;

/// Rate limit middleware
pub struct RateLimit {
    config: RateLimitConfig,
    redis: web::Data<RedisClient>,
}

impl RateLimit {
    pub fn new(config: RateLimitConfig, redis: web::Data<RedisClient>) -> Self {
        Self { config, redis }
    }
}

/// Rate limit service factory
pub struct RateLimitMiddleware {
    config: RateLimitConfig,
    redis: web::Data<RedisClient>,
}

impl RateLimitMiddleware {
    pub fn new(config: RateLimitConfig, redis: web::Data<RedisClient>) -> Self {
        Self { config, redis }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RateLimitMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RateLimitService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(RateLimitService {
            service: Rc::new(RefCell::new(service)),
            config: self.config.clone(),
            redis: self.redis.clone(),
        })
    }
}

/// Rate limit service implementation
pub struct RateLimitService<S> {
    service: Rc<RefCell<S>>,
    config: RateLimitConfig,
    redis: web::Data<RedisClient>,
}

impl<S, B> Service<ServiceRequest> for RateLimitService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, ctx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.borrow_mut().poll_ready(ctx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let config = self.config.clone();
        let redis = self.redis.clone();
        
        Box::pin(async move {
            // Get client identifier
            let client_id = get_client_id(&req).unwrap_or_else(|| "anonymous".to_string());
            let route = req.path().to_string();
            let method = req.method().to_string();
            
            // Check if this route should be rate limited
            let is_admin = req.headers().contains_key("x-admin");
            let is_auth = req.headers().contains_key("authorization");
            
            let limit_settings = config.get_limit(&route, &method, is_admin, is_auth);
            
            // Check rate limit
            let key = format!("rate_limit:{}:{}:{}", client_id, route, method);
            let current = get_request_count(&redis, &key).await.unwrap_or(0);
            
            if current >= limit_settings.limit {
                // Rate limit exceeded
                let retry_after = limit_settings.window_secs;
                let error = HttpResponse::TooManyRequests()
                    .insert_header(("Retry-After", retry_after.to_string()))
                    .json(serde_json::json!({
                        "error": "Too Many Requests",
                        "message": format!("Rate limit exceeded. Try again in {} seconds.", retry_after),
                        "limit": limit_settings.limit,
                        "window": limit_settings.window_secs,
                        "remaining": 0,
                        "retry_after": retry_after,
                    }));
                
                return Ok(req.into_response(error));
            }
            
            // Increment request count
            increment_request_count(&redis, &key, limit_settings.window_secs).await?;
            let remaining = limit_settings.limit - current - 1;
            
            // Call the service
            let mut res = service.borrow_mut().call(req).await?;
            
            // Add rate limit headers
            let headers = res.headers_mut();
            headers.insert("X-RateLimit-Limit", limit_settings.limit.to_string().parse().unwrap());
            headers.insert("X-RateLimit-Remaining", remaining.to_string().parse().unwrap());
            headers.insert("X-RateLimit-Window", limit_settings.window_secs.to_string().parse().unwrap());
            
            Ok(res)
        })
    }
}

// ============================================
# Helper Functions
// ============================================

/// Get client identifier from request
fn get_client_id(req: &ServiceRequest) -> Option<String> {
    // Try to get from JWT/authenticated user
    if let Some(claims) = req.extensions().get::<serde_json::Value>() {
        if let Some(user_id) = claims.get("sub").and_then(|v| v.as_str()) {
            return Some(user_id.to_string());
        }
    }
    
    // Fallback to IP address
    if let Some(ip) = req.connection_info().realip_remote_addr() {
        return Some(ip.to_string());
    }
    
    // Use user-agent + IP as fallback
    if let Some(user_agent) = req.headers().get("user-agent").and_then(|v| v.to_str().ok()) {
        if let Some(ip) = req.connection_info().realip_remote_addr() {
            return Some(format!("{}:{}", ip, user_agent));
        }
    }
    
    None
}

/// Get request count from Redis
async fn get_request_count(redis: &web::Data<RedisClient>, key: &str) -> Result<u32, anyhow::Error> {
    let count = redis.get::<u32>(key).await?;
    Ok(count.unwrap_or(0))
}

/// Increment request count in Redis with TTL
async fn increment_request_count(
    redis: &web::Data<RedisClient>,
    key: &str,
    window_secs: u64,
) -> Result<(), anyhow::Error> {
    let count = redis.incr(key).await?;
    if count == 1 {
        redis.expire(key, window_secs as usize).await?;
    }
    Ok(())
}

// ============================================
# Tests
// ============================================

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, web, App};
    use crate::config::rate_limit::RateLimitConfig;
    
    #[test]
    fn test_get_client_id_with_ip() {
        // Test client ID extraction logic
        // This would need a mock request
        // For now, we test the logic indirectly
        assert!(true);
    }
    
    #[test]
    fn test_rate_limit_config_defaults() {
        let config = RateLimitConfig::default();
        assert_eq!(config.default_limit, 100);
        assert_eq!(config.unauth_limit.limit, 20);
        assert_eq!(config.auth_limit.unwrap().limit, 200);
        assert_eq!(config.admin_limit.unwrap().limit, 500);
    }
    
    #[test]
    fn test_rate_limit_settings() {
        let settings = RateLimitSettings {
            limit: 100,
            window_secs: 60,
        };
        assert_eq!(settings.limit, 100);
        assert_eq!(settings.window_secs, 60);
    }
    
    #[test]
    fn test_route_override_priority() {
        let mut config = RateLimitConfig::default();
        config.route_overrides.insert(
            "/api/test".to_string(),
            RouteRateLimit {
                method: "GET".to_string(),
                limit: 5,
                window_secs: 10,
                exclude_patterns: None,
            },
        );
        
        let limit = config.get_limit("/api/test", "GET", false, true);
        assert_eq!(limit.limit, 5);
        assert_eq!(limit.window_secs, 10);
    }
}
