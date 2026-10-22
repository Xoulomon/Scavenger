//! HTTP transport abstraction used by channels that speak to a remote API
//! (push via FCM, webhook via an arbitrary subscriber URL).
//!
//! Channels depend on `Arc<dyn HttpTransport>` rather than constructing a
//! `reqwest::Client` directly, so tests can inject a mock transport instead
//! of making real network calls.

use async_trait::async_trait;
use serde_json::Value;

#[async_trait]
pub trait HttpTransport: Send + Sync {
    /// POST `payload` as JSON to `url`, returning the response status code
    /// on success or a transport-level error string on failure.
    async fn post_json(&self, url: &str, payload: Value) -> Result<u16, String>;
}

/// Production transport backed by `reqwest`.
pub struct ReqwestTransport {
    client: reqwest::Client,
}

impl ReqwestTransport {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
}

impl Default for ReqwestTransport {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl HttpTransport for ReqwestTransport {
    async fn post_json(&self, url: &str, payload: Value) -> Result<u16, String> {
        let response = self
            .client
            .post(url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(response.status().as_u16())
    }
}

#[cfg(test)]
pub mod mock {
    use super::*;
    use std::sync::Mutex;

    /// Records every call made to it and returns a canned result, so channel
    /// tests can assert on outbound payloads without touching the network.
    pub struct MockTransport {
        pub result: Result<u16, String>,
        pub calls: Mutex<Vec<(String, Value)>>,
    }

    impl MockTransport {
        pub fn success(status: u16) -> Self {
            Self {
                result: Ok(status),
                calls: Mutex::new(Vec::new()),
            }
        }

        pub fn failure(msg: impl Into<String>) -> Self {
            Self {
                result: Err(msg.into()),
                calls: Mutex::new(Vec::new()),
            }
        }

        pub fn call_count(&self) -> usize {
            self.calls.lock().unwrap().len()
        }

        pub fn last_payload(&self) -> Option<Value> {
            self.calls.lock().unwrap().last().map(|(_, p)| p.clone())
        }
    }

    #[async_trait]
    impl HttpTransport for MockTransport {
        async fn post_json(&self, url: &str, payload: Value) -> Result<u16, String> {
            self.calls.lock().unwrap().push((url.to_string(), payload));
            self.result.clone()
        }
    }
}
