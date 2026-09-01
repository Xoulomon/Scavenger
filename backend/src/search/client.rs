use elasticsearch::{
    Elasticsearch,
    http::transport::{SingleNodeConnectionPool, TransportBuilder},
    cert::CertificateValidation,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::{Result, Context};
use url::Url;

/// Configuration for Elasticsearch client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchClientConfig {
    pub url: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub timeout_seconds: u64,
    pub validate_certificates: bool,
}

impl Default for SearchClientConfig {
    fn default() -> Self {
        Self {
            url: "http://localhost:9200".to_string(),
            username: None,
            password: None,
            timeout_seconds: 30,
            validate_certificates: true,
        }
    }
}

/// Wrapper around Elasticsearch client
#[derive(Clone)]
pub struct SearchClient {
    client: Arc<Elasticsearch>,
    config: SearchClientConfig,
}

impl SearchClient {
    /// Create a new search client with the given configuration
    pub fn new(config: SearchClientConfig) -> Result<Self> {
        let url = Url::parse(&config.url)
            .context("Invalid Elasticsearch URL")?;

        let conn_pool = SingleNodeConnectionPool::new(url);

        let mut transport_builder = TransportBuilder::new(conn_pool);

        // Set timeout
        transport_builder = transport_builder.timeout(
            std::time::Duration::from_secs(config.timeout_seconds)
        );

        // Configure certificate validation
        if !config.validate_certificates {
            transport_builder = transport_builder.cert_validation(
                CertificateValidation::None
            );
        }

        // Add authentication if provided
        if let (Some(username), Some(password)) = (&config.username, &config.password) {
            transport_builder = transport_builder.auth(
                elasticsearch::auth::Credentials::Basic(
                    username.clone(),
                    password.clone(),
                )
            );
        }

        let transport = transport_builder.build()
            .context("Failed to build Elasticsearch transport")?;

        let client = Elasticsearch::new(transport);

        Ok(Self {
            client: Arc::new(client),
            config,
        })
    }

    /// Get the underlying Elasticsearch client
    pub fn client(&self) -> &Elasticsearch {
        &self.client
    }

    /// Check if the Elasticsearch cluster is healthy
    pub async fn health_check(&self) -> Result<bool> {
        let response = self.client
            .cluster()
            .health(elasticsearch::cluster::ClusterHealthParts::None)
            .send()
            .await
            .context("Failed to check cluster health")?;

        Ok(response.status_code().is_success())
    }

    /// Get cluster information
    pub async fn cluster_info(&self) -> Result<serde_json::Value> {
        let response = self.client
            .info()
            .send()
            .await
            .context("Failed to get cluster info")?;

        let body = response.json::<serde_json::Value>().await
            .context("Failed to parse cluster info")?;

        Ok(body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = SearchClientConfig::default();
        assert_eq!(config.url, "http://localhost:9200");
        assert_eq!(config.timeout_seconds, 30);
        assert!(config.validate_certificates);
    }

    #[test]
    fn test_client_creation() {
        let config = SearchClientConfig::default();
        let result = SearchClient::new(config);
        assert!(result.is_ok());
    }
}
