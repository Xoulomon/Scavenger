//! Rate limit configuration module
//! 
//! This module provides configurable rate limiting for the API.
//! All limits can be tuned via environment variables per environment.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

/// Rate limit configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Default rate limit (requests per window)
    pub default_limit: u32,
    /// Default time window in seconds
    pub default_window_secs: u64,
    /// Per-route overrides
    pub route_overrides: HashMap<String, RouteRateLimit>,
    /// Admin rate limit (higher limit for admin users)
    pub admin_limit: Option<RateLimitSettings>,
    /// Authenticated user rate limit
    pub auth_limit: Option<RateLimitSettings>,
    /// Unauthenticated user rate limit (stricter)
    pub unauth_limit: RateLimitSettings,
}

/// Rate limit settings for a specific route or user type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitSettings {
    pub limit: u32,
    pub window_secs: u64,
}

/// Per-route rate limit configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteRateLimit {
    pub method: String,
    pub limit: u32,
    pub window_secs: u64,
    pub exclude_patterns: Option<Vec<String>>,
}

impl RateLimitConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Self {
        let default_limit = std::env::var("RATE_LIMIT_DEFAULT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(100);
        
        let default_window_secs = std::env::var("RATE_LIMIT_WINDOW")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);
        
        let admin_limit = std::env::var("RATE_LIMIT_ADMIN")
            .ok()
            .and_then(|v| {
                let parts: Vec<&str> = v.split(',').collect();
                if parts.len() == 2 {
                    Some(RateLimitSettings {
                        limit: parts[0].parse().unwrap_or(500),
                        window_secs: parts[1].parse().unwrap_or(60),
                    })
                } else {
                    None
                }
            });
        
        let auth_limit = std::env::var("RATE_LIMIT_AUTH")
            .ok()
            .and_then(|v| {
                let parts: Vec<&str> = v.split(',').collect();
                if parts.len() == 2 {
                    Some(RateLimitSettings {
                        limit: parts[0].parse().unwrap_or(200),
                        window_secs: parts[1].parse().unwrap_or(60),
                    })
                } else {
                    None
                }
            });
        
        let unauth_limit = std::env::var("RATE_LIMIT_UNAUTH")
            .ok()
            .and_then(|v| {
                let parts: Vec<&str> = v.split(',').collect();
                if parts.len() == 2 {
                    Some(RateLimitSettings {
                        limit: parts[0].parse().unwrap_or(20),
                        window_secs: parts[1].parse().unwrap_or(60),
                    })
                } else {
                    None
                }
            })
            .unwrap_or(RateLimitSettings {
                limit: 20,
                window_secs: 60,
            });
        
        // Parse route overrides from env
        let mut route_overrides = HashMap::new();
        if let Ok(overrides_str) = std::env::var("RATE_LIMIT_ROUTES") {
            for part in overrides_str.split(';') {
                let parts: Vec<&str> = part.split(',').collect();
                if parts.len() >= 3 {
                    let method = parts[0].to_string();
                    let route = parts[1].to_string();
                    let limit = parts[2].parse().unwrap_or(100);
                    let window_secs = if parts.len() > 3 {
                        parts[3].parse().unwrap_or(60)
                    } else {
                        60
                    };
                    route_overrides.insert(
                        route,
                        RouteRateLimit {
                            method,
                            limit,
                            window_secs,
                            exclude_patterns: None,
                        },
                    );
                }
            }
        }
        
        Self {
            default_limit,
            default_window_secs,
            route_overrides,
            admin_limit,
            auth_limit,
            unauth_limit,
        }
    }
    
    /// Get the rate limit for a specific route and user type
    pub fn get_limit(&self, route: &str, method: &str, is_admin: bool, is_auth: bool) -> RateLimitSettings {
        // Check for route-specific override
        if let Some(override_config) = self.route_overrides.get(route) {
            if override_config.method == method {
                return RateLimitSettings {
                    limit: override_config.limit,
                    window_secs: override_config.window_secs,
                };
            }
        }
        
        // Check for user type-specific limits
        if is_admin {
            if let Some(admin_limit) = &self.admin_limit {
                return admin_limit.clone();
            }
        }
        
        if is_auth {
            if let Some(auth_limit) = &self.auth_limit {
                return auth_limit.clone();
            }
        }
        
        // Unauthenticated user (strictest)
        self.unauth_limit.clone()
    }
    
    /// Get default window as Duration
    pub fn default_window(&self) -> Duration {
        Duration::from_secs(self.default_window_secs)
    }
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            default_limit: 100,
            default_window_secs: 60,
            route_overrides: HashMap::new(),
            admin_limit: Some(RateLimitSettings {
                limit: 500,
                window_secs: 60,
            }),
            auth_limit: Some(RateLimitSettings {
                limit: 200,
                window_secs: 60,
            }),
            unauth_limit: RateLimitSettings {
                limit: 20,
                window_secs: 60,
            },
        }
    }
}

/// Environment variable names for rate limit configuration
pub mod env_vars {
    pub const RATE_LIMIT_DEFAULT: &str = "RATE_LIMIT_DEFAULT";
    pub const RATE_LIMIT_WINDOW: &str = "RATE_LIMIT_WINDOW";
    pub const RATE_LIMIT_ADMIN: &str = "RATE_LIMIT_ADMIN";
    pub const RATE_LIMIT_AUTH: &str = "RATE_LIMIT_AUTH";
    pub const RATE_LIMIT_UNAUTH: &str = "RATE_LIMIT_UNAUTH";
    pub const RATE_LIMIT_ROUTES: &str = "RATE_LIMIT_ROUTES";
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_config() {
        let config = RateLimitConfig::default();
        assert_eq!(config.default_limit, 100);
        assert_eq!(config.default_window_secs, 60);
        assert_eq!(config.unauth_limit.limit, 20);
    }
    
    #[test]
    fn test_get_limit_unauth() {
        let config = RateLimitConfig::default();
        let limit = config.get_limit("/api/test", "GET", false, false);
        assert_eq!(limit.limit, 20);
        assert_eq!(limit.window_secs, 60);
    }
    
    #[test]
    fn test_get_limit_auth() {
        let config = RateLimitConfig::default();
        let limit = config.get_limit("/api/test", "GET", false, true);
        assert_eq!(limit.limit, 200);
        assert_eq!(limit.window_secs, 60);
    }
    
    #[test]
    fn test_get_limit_admin() {
        let config = RateLimitConfig::default();
        let limit = config.get_limit("/api/test", "GET", true, true);
        assert_eq!(limit.limit, 500);
        assert_eq!(limit.window_secs, 60);
    }
    
    #[test]
    fn test_route_override() {
        let mut config = RateLimitConfig::default();
        config.route_overrides.insert(
            "/api/sensitive".to_string(),
            RouteRateLimit {
                method: "POST".to_string(),
                limit: 10,
                window_secs: 60,
                exclude_patterns: None,
            },
        );
        
        let limit = config.get_limit("/api/sensitive", "POST", false, true);
        assert_eq!(limit.limit, 10);
        assert_eq!(limit.window_secs, 60);
    }
}
