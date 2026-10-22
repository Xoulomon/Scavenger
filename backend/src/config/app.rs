//! #1159: Central application config.
//!
//! All `std::env::var` reads that previously lived in `main.rs` or other
//! non-config modules have been moved here.  This is the single place to:
//!
//! * Add a new runtime knob — add a field + read it in `from_env`.
//! * Change a default — change `unwrap_or_else` here, not scattered throughout.
//! * Validate required vars at startup — add a check in `validate`.
//!
//! # Required vs optional
//!
//! | Variable          | Required | Default              |
//! |-------------------|----------|----------------------|
//! | `LOG_FORMAT`      | no       | `pretty`             |
//! | `CSRF_SECRET`     | prod     | `change-me-in-production` |
//! | `ALLOWED_ORIGINS` | no       | `http://localhost:3000` |
//! | `REDIS_URL`       | no       | `None` (in-memory cache) |

/// Application-level configuration loaded from environment variables.
///
/// Construct via [`AppConfig::from_env`] and validate via [`AppConfig::validate`].
#[derive(Debug, Clone)]
pub struct AppConfig {
    /// `LOG_FORMAT` — `"json"` or `"pretty"`. Default: `"pretty"`.
    pub log_format: String,

    /// `CSRF_SECRET` — secret used to sign CSRF tokens.
    /// Must be changed in production; the default is insecure.
    pub csrf_secret: String,

    /// `ALLOWED_ORIGINS` — comma-separated list of allowed CORS origins.
    /// Default: `"http://localhost:3000"`.
    pub allowed_origins: String,

    /// `REDIS_URL` — optional Redis connection URL.
    /// When `None` the cache layer operates in-memory only.
    pub redis_url: Option<String>,
}

impl AppConfig {
    /// Build `AppConfig` from environment variables.
    ///
    /// All variables are optional; safe defaults are provided for local
    /// development.  Call [`AppConfig::validate`] after construction to
    /// enforce production requirements.
    pub fn from_env() -> Self {
        Self {
            log_format: std::env::var("LOG_FORMAT").unwrap_or_else(|_| "pretty".to_string()),
            csrf_secret: std::env::var("CSRF_SECRET")
                .unwrap_or_else(|_| "change-me-in-production".to_string()),
            allowed_origins: std::env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            redis_url: std::env::var("REDIS_URL").ok(),
        }
    }

    /// Validate the config, returning an error string for any fatal violation.
    ///
    /// Currently enforces:
    /// * `CSRF_SECRET` must not be the insecure default in production.
    ///   "Production" is detected by the absence of `ALLOW_INSECURE_CSRF=1`.
    /// * `LOG_FORMAT` must be one of the recognized values (`json`, `pretty`).
    /// * `ALLOWED_ORIGINS` must not be empty and must contain only
    ///   well-formed `http(s)://` origins.
    /// * `REDIS_URL`, when set, must be a well-formed `redis://` /
    ///   `rediss://` URL.
    ///
    /// This is the single fail-fast gate called from `main()` at startup —
    /// any `Err` here should abort process startup with the returned
    /// message rather than let the server run with silently-misconfigured
    /// values.
    pub fn validate(&self) -> Result<(), String> {
        let allow_insecure = std::env::var("ALLOW_INSECURE_CSRF")
            .map(|v| v == "1" || v.to_lowercase() == "true")
            .unwrap_or(false);

        if self.csrf_secret == "change-me-in-production" && !allow_insecure {
            return Err(
                "CSRF_SECRET is set to the insecure default. \
                 Set a strong secret or set ALLOW_INSECURE_CSRF=1 to suppress this check."
                    .to_string(),
            );
        }

        let normalized_format = self.log_format.to_lowercase();
        if normalized_format != "json" && normalized_format != "pretty" {
            return Err(format!(
                "LOG_FORMAT must be one of \"json\" or \"pretty\", got {:?}.",
                self.log_format
            ));
        }

        if self.allowed_origins.trim().is_empty() {
            return Err("ALLOWED_ORIGINS must not be empty.".to_string());
        }
        for origin in self.allowed_origins.split(',') {
            let origin = origin.trim();
            if origin.is_empty() {
                return Err(
                    "ALLOWED_ORIGINS contains an empty entry (check for stray commas)."
                        .to_string(),
                );
            }
            if !origin.starts_with("http://") && !origin.starts_with("https://") {
                return Err(format!(
                    "ALLOWED_ORIGINS entry {:?} is not a valid http(s):// origin.",
                    origin
                ));
            }
        }

        if let Some(ref url) = self.redis_url {
            if !url.starts_with("redis://") && !url.starts_with("rediss://") {
                return Err(format!(
                    "REDIS_URL {:?} is not a valid redis:// or rediss:// URL.",
                    url
                ));
            }
        }

        Ok(())
    }

    /// Returns `true` when `log_format` is `"json"` (case-insensitive).
    pub fn use_json_logging(&self) -> bool {
        self.log_format.to_lowercase() == "json"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── from_env defaults ──────────────────────────────────────────────────

    #[test]
    fn test_default_log_format_is_pretty() {
        // Without env override, log format defaults to "pretty"
        std::env::remove_var("LOG_FORMAT");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.log_format, "pretty");
        assert!(!cfg.use_json_logging());
    }

    #[test]
    fn test_json_log_format_detected() {
        std::env::set_var("LOG_FORMAT", "json");
        let cfg = AppConfig::from_env();
        assert!(cfg.use_json_logging());
        std::env::remove_var("LOG_FORMAT");
    }

    #[test]
    fn test_json_log_format_case_insensitive() {
        std::env::set_var("LOG_FORMAT", "JSON");
        let cfg = AppConfig::from_env();
        assert!(cfg.use_json_logging());
        std::env::remove_var("LOG_FORMAT");
    }

    #[test]
    fn test_default_allowed_origins() {
        std::env::remove_var("ALLOWED_ORIGINS");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.allowed_origins, "http://localhost:3000");
    }

    #[test]
    fn test_redis_url_is_none_by_default() {
        std::env::remove_var("REDIS_URL");
        let cfg = AppConfig::from_env();
        assert!(cfg.redis_url.is_none());
    }

    #[test]
    fn test_redis_url_read_from_env() {
        std::env::set_var("REDIS_URL", "redis://localhost:6379");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.redis_url.as_deref(), Some("redis://localhost:6379"));
        std::env::remove_var("REDIS_URL");
    }

    // ── validate ───────────────────────────────────────────────────────────

    #[test]
    fn test_validate_insecure_default_fails_without_override() {
        std::env::remove_var("ALLOW_INSECURE_CSRF");
        let cfg = AppConfig {
            log_format: "pretty".to_string(),
            csrf_secret: "change-me-in-production".to_string(),
            allowed_origins: "http://localhost:3000".to_string(),
            redis_url: None,
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn test_validate_insecure_default_passes_with_override() {
        std::env::set_var("ALLOW_INSECURE_CSRF", "1");
        let cfg = AppConfig {
            log_format: "pretty".to_string(),
            csrf_secret: "change-me-in-production".to_string(),
            allowed_origins: "http://localhost:3000".to_string(),
            redis_url: None,
        };
        assert!(cfg.validate().is_ok());
        std::env::remove_var("ALLOW_INSECURE_CSRF");
    }

    #[test]
    fn test_validate_strong_secret_always_passes() {
        std::env::remove_var("ALLOW_INSECURE_CSRF");
        let cfg = AppConfig {
            log_format: "pretty".to_string(),
            csrf_secret: "super-strong-random-secret-xyz".to_string(),
            allowed_origins: "http://localhost:3000".to_string(),
            redis_url: None,
        };
        assert!(cfg.validate().is_ok());
    }

    // ── validate: LOG_FORMAT ──────────────────────────────────────────────

    #[test]
    fn test_validate_rejects_invalid_log_format() {
        let cfg = AppConfig {
            log_format: "yaml".to_string(),
            csrf_secret: "super-strong-random-secret-xyz".to_string(),
            allowed_origins: "http://localhost:3000".to_string(),
            redis_url: None,
        };
        let err = cfg.validate().unwrap_err();
        assert!(err.contains("LOG_FORMAT"));
    }

    // ── validate: ALLOWED_ORIGINS ─────────────────────────────────────────

    #[test]
    fn test_validate_rejects_empty_allowed_origins() {
        let cfg = AppConfig {
            log_format: "pretty".to_string(),
            csrf_secret: "super-strong-random-secret-xyz".to_string(),
            allowed_origins: "   ".to_string(),
            redis_url: None,
        };
        let err = cfg.validate().unwrap_err();
        assert!(err.contains("ALLOWED_ORIGINS"));
    }

    #[test]
    fn test_validate_rejects_malformed_origin() {
        let cfg = AppConfig {
            log_format: "pretty".to_string(),
            csrf_secret: "super-strong-random-secret-xyz".to_string(),
            allowed_origins: "not-a-url".to_string(),
            redis_url: None,
        };
        let err = cfg.validate().unwrap_err();
        assert!(err.contains("not-a-url"));
    }

    #[test]
    fn test_validate_accepts_multiple_valid_origins() {
        let cfg = AppConfig {
            log_format: "pretty".to_string(),
            csrf_secret: "super-strong-random-secret-xyz".to_string(),
            allowed_origins: "http://localhost:3000,https://app.example.com".to_string(),
            redis_url: None,
        };
        assert!(cfg.validate().is_ok());
    }

    // ── validate: REDIS_URL ───────────────────────────────────────────────

    #[test]
    fn test_validate_rejects_malformed_redis_url() {
        let cfg = AppConfig {
            log_format: "pretty".to_string(),
            csrf_secret: "super-strong-random-secret-xyz".to_string(),
            allowed_origins: "http://localhost:3000".to_string(),
            redis_url: Some("localhost:6379".to_string()),
        };
        let err = cfg.validate().unwrap_err();
        assert!(err.contains("REDIS_URL"));
    }

    #[test]
    fn test_validate_accepts_well_formed_redis_url() {
        let cfg = AppConfig {
            log_format: "pretty".to_string(),
            csrf_secret: "super-strong-random-secret-xyz".to_string(),
            allowed_origins: "http://localhost:3000".to_string(),
            redis_url: Some("redis://localhost:6379".to_string()),
        };
        assert!(cfg.validate().is_ok());
    }
}
