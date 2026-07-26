//! Centralized application configuration.
//!
//! All environment variables are read and validated here at startup.
//! Calling [`AppConfig::from_env`] returns an error if any required
//! variable is missing or if a value fails to parse, so the process
//! fails fast rather than discovering a missing variable deep at runtime.
//!
//! # Usage
//!
//! ```rust,ignore
//! let config = AppConfig::from_env().expect("invalid configuration");
//! ```

use std::env;
use std::fmt;

/// Errors that can occur while loading the application configuration.
#[derive(Debug)]
pub enum ConfigError {
    /// A required environment variable was not set.
    MissingVar(String),
    /// A variable was set but could not be parsed into the expected type.
    ParseError { var: String, message: String },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::MissingVar(var) => {
                write!(f, "required environment variable '{}' is not set", var)
            }
            ConfigError::ParseError { var, message } => {
                write!(
                    f,
                    "environment variable '{}' has an invalid value: {}",
                    var, message
                )
            }
        }
    }
}

impl std::error::Error for ConfigError {}

// ── Server ────────────────────────────────────────────────────────────────────

/// HTTP server configuration.
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Address to bind to (default: `0.0.0.0`).
    pub host: String,
    /// Port to listen on (default: `8080`).
    pub port: u16,
    /// Comma-separated list of allowed CORS origins.
    pub allowed_origins: String,
}

// ── Database ──────────────────────────────────────────────────────────────────

/// Postgres / database configuration.
#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    /// Full connection URL, e.g. `postgres://user:pass@host/db`.
    pub url: String,
}

// ── Logging ───────────────────────────────────────────────────────────────────

/// Logging / tracing configuration.
#[derive(Debug, Clone)]
pub struct LogConfig {
    /// Log level filter (default: `info`).
    pub level: String,
    /// Set to `json` for structured JSON logs; anything else = pretty text.
    pub format: String,
}

// ── Services ──────────────────────────────────────────────────────────────────

/// Third-party service credentials and settings.
#[derive(Debug, Clone)]
pub struct ServicesConfig {
    /// SendGrid API key (optional — email disabled when absent).
    pub sendgrid_api_key: Option<String>,
    /// Sender address for outbound email.
    pub from_email: String,
    /// Firebase project ID (optional — push notifications disabled when absent).
    pub firebase_project_id: Option<String>,
    /// S3 bucket name for file storage.
    pub s3_bucket: Option<String>,
    /// AWS region (default: `us-east-1`).
    pub aws_region: String,
    /// Elasticsearch URL (default: `http://localhost:9200`).
    pub elasticsearch_url: String,
    /// Elasticsearch username (optional).
    pub elasticsearch_username: Option<String>,
    /// Elasticsearch password (optional).
    pub elasticsearch_password: Option<String>,
}

// ── Security ──────────────────────────────────────────────────────────────────

/// Security-related settings.
#[derive(Debug, Clone)]
pub struct SecurityConfig {
    /// Secret used to sign CSRF tokens.
    pub csrf_secret: String,
}

// ── Storage ───────────────────────────────────────────────────────────────────

/// Local file-system storage settings.
#[derive(Debug, Clone)]
pub struct StorageConfig {
    /// Directory for report files (default: `/tmp`).
    pub storage_path: String,
    /// Directory for archival files (default: `/tmp/archives`).
    pub archival_storage_path: String,
}

// ── Root config ───────────────────────────────────────────────────────────────

/// Complete, validated application configuration.
///
/// Construct once at startup via [`AppConfig::from_env`] and share as
/// `Arc<AppConfig>` or `web::Data<AppConfig>`.
#[derive(Debug, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub log: LogConfig,
    pub services: ServicesConfig,
    pub security: SecurityConfig,
    pub storage: StorageConfig,
}

impl AppConfig {
    /// Load and validate configuration from environment variables.
    ///
    /// Returns [`ConfigError`] immediately on the first validation failure
    /// so the process exits before any services are started.
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(AppConfig {
            server: ServerConfig {
                host: optional_var("HOST", "0.0.0.0"),
                port: parse_var("PORT", 8080)?,
                allowed_origins: optional_var("ALLOWED_ORIGINS", "http://localhost:3000"),
            },
            database: DatabaseConfig {
                url: required_var("DATABASE_URL")?,
            },
            log: LogConfig {
                level: optional_var("RUST_LOG", "info"),
                format: optional_var("LOG_FORMAT", "pretty"),
            },
            services: ServicesConfig {
                sendgrid_api_key: env::var("SENDGRID_API_KEY").ok(),
                from_email: optional_var("FROM_EMAIL", "noreply@scavenger.io"),
                firebase_project_id: env::var("FIREBASE_PROJECT_ID").ok(),
                s3_bucket: env::var("S3_BUCKET").ok(),
                aws_region: optional_var("AWS_REGION", "us-east-1"),
                elasticsearch_url: optional_var("ELASTICSEARCH_URL", "http://localhost:9200"),
                elasticsearch_username: env::var("ELASTICSEARCH_USERNAME").ok(),
                elasticsearch_password: env::var("ELASTICSEARCH_PASSWORD").ok(),
            },
            security: SecurityConfig {
                csrf_secret: optional_var("CSRF_SECRET", "change-me-in-production"),
            },
            storage: StorageConfig {
                storage_path: optional_var("STORAGE_PATH", "/tmp"),
                archival_storage_path: optional_var("ARCHIVAL_STORAGE_PATH", "/tmp/archives"),
            },
        })
    }

    /// Convenience: bind address formatted as `host:port`.
    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.server.host, self.server.port)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Return the value of an optional environment variable, or `default`.
fn optional_var(name: &str, default: &str) -> String {
    env::var(name).unwrap_or_else(|_| default.to_string())
}

/// Return the value of a required environment variable.
///
/// Returns [`ConfigError::MissingVar`] if the variable is not set.
fn required_var(name: &str) -> Result<String, ConfigError> {
    env::var(name).map_err(|_| ConfigError::MissingVar(name.to_string()))
}

/// Parse an optional environment variable into type `T`.
///
/// Returns `default` when the variable is absent, and
/// [`ConfigError::ParseError`] when it is present but cannot be parsed.
fn parse_var<T>(name: &str, default: T) -> Result<T, ConfigError>
where
    T: std::str::FromStr,
    T::Err: fmt::Display,
{
    match env::var(name) {
        Err(_) => Ok(default),
        Ok(raw) => raw.parse().map_err(|e| ConfigError::ParseError {
            var: name.to_string(),
            message: e.to_string(),
        }),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Run `f` with the given env vars set, restoring originals afterwards.
    fn with_env<F: FnOnce()>(vars: &[(&str, &str)], f: F) {
        let originals: Vec<_> = vars
            .iter()
            .map(|(k, _)| (*k, env::var(k).ok()))
            .collect();
        for (k, v) in vars {
            env::set_var(k, v);
        }
        f();
        for (k, original) in &originals {
            match original {
                Some(v) => env::set_var(k, v),
                None => env::remove_var(k),
            }
        }
    }

    fn remove_env(vars: &[&str]) {
        for v in vars {
            env::remove_var(v);
        }
    }

    #[test]
    fn test_from_env_succeeds_with_required_vars() {
        with_env(&[("DATABASE_URL", "postgres://user:pass@localhost/test")], || {
            let cfg = AppConfig::from_env().expect("should succeed");
            assert_eq!(cfg.database.url, "postgres://user:pass@localhost/test");
        });
    }

    #[test]
    fn test_from_env_fails_without_database_url() {
        remove_env(&["DATABASE_URL"]);
        let result = AppConfig::from_env();
        assert!(result.is_err(), "should fail when DATABASE_URL is missing");
        let err = result.unwrap_err().to_string();
        assert!(err.contains("DATABASE_URL"), "error should mention the variable");
    }

    #[test]
    fn test_defaults_are_applied() {
        with_env(&[("DATABASE_URL", "postgres://localhost/test")], || {
            remove_env(&["HOST", "PORT", "ALLOWED_ORIGINS", "LOG_FORMAT", "AWS_REGION"]);
            let cfg = AppConfig::from_env().expect("should succeed");
            assert_eq!(cfg.server.host, "0.0.0.0");
            assert_eq!(cfg.server.port, 8080);
            assert_eq!(cfg.server.allowed_origins, "http://localhost:3000");
            assert_eq!(cfg.log.format, "pretty");
            assert_eq!(cfg.services.aws_region, "us-east-1");
        });
    }

    #[test]
    fn test_custom_port_is_parsed() {
        with_env(
            &[
                ("DATABASE_URL", "postgres://localhost/test"),
                ("PORT", "9090"),
            ],
            || {
                let cfg = AppConfig::from_env().expect("should succeed");
                assert_eq!(cfg.server.port, 9090);
            },
        );
    }

    #[test]
    fn test_invalid_port_returns_parse_error() {
        with_env(
            &[
                ("DATABASE_URL", "postgres://localhost/test"),
                ("PORT", "not_a_number"),
            ],
            || {
                let result = AppConfig::from_env();
                assert!(result.is_err(), "should fail on invalid PORT");
                let err = result.unwrap_err().to_string();
                assert!(err.contains("PORT"), "error should mention PORT");
            },
        );
    }

    #[test]
    fn test_optional_service_keys_are_none_when_absent() {
        with_env(&[("DATABASE_URL", "postgres://localhost/test")], || {
            remove_env(&["SENDGRID_API_KEY", "FIREBASE_PROJECT_ID", "S3_BUCKET"]);
            let cfg = AppConfig::from_env().expect("should succeed");
            assert!(cfg.services.sendgrid_api_key.is_none());
            assert!(cfg.services.firebase_project_id.is_none());
            assert!(cfg.services.s3_bucket.is_none());
        });
    }

    #[test]
    fn test_bind_address_format() {
        with_env(
            &[
                ("DATABASE_URL", "postgres://localhost/test"),
                ("HOST", "127.0.0.1"),
                ("PORT", "3000"),
            ],
            || {
                let cfg = AppConfig::from_env().expect("should succeed");
                assert_eq!(cfg.bind_address(), "127.0.0.1:3000");
            },
        );
    }

    #[test]
    fn test_config_error_display_missing() {
        let e = ConfigError::MissingVar("MY_VAR".to_string());
        assert!(e.to_string().contains("MY_VAR"));
        assert!(e.to_string().contains("not set"));
    }

    #[test]
    fn test_config_error_display_parse() {
        let e = ConfigError::ParseError {
            var: "PORT".to_string(),
            message: "invalid digit found in string".to_string(),
        };
        assert!(e.to_string().contains("PORT"));
        assert!(e.to_string().contains("invalid digit"));
    }
}
