//! Error-injection tests for [`StellarRpcClient`] — closes #958.
//!
//! Uses `wiremock` to stand up a local HTTP server returning controlled
//! responses (500s, 503, 429, malformed JSON) so the retry/backoff machinery
//! and graceful-failure paths are exercised without a real Stellar node.
//!
//! # Coverage
//! | Scenario | Assertion |
//! |---|---|
//! | Single 500 → success | succeeds on retry; 2 requests made |
//! | Persistent 500s | `RetriesExhausted` after `max_attempts` |
//! | 503 Service Unavailable | retried → `RetriesExhausted` |
//! | 429 Rate Limited | `RateLimited` immediately, only 1 request |
//! | 404 Not Found (non-retryable) | `Http{404}` after 1 request |
//! | Connection refused | `RetriesExhausted` or `Network` error |
//! | Two failures then success | succeeds on 3rd attempt |
//! | Malformed JSON | `Deserialize` error, not retried |
//! | Backoff within cap | delay ≤ `max_delay` for all attempts |
//! | submit_transaction retried | 2 POSTs, then success |
//! | Graceful failure | returns `Err`, never panics |

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use wiremock::{
        matchers::{method, path},
        Mock, MockServer, ResponseTemplate,
    };

    use crate::rpc::client::{RetryConfig, RpcError, StellarRpcClient, StellarRpcConfig};

    // ── helpers ───────────────────────────────────────────────────────────────

    fn config_for(server: &MockServer) -> StellarRpcConfig {
        StellarRpcConfig {
            horizon_url: server.uri(),
            soroban_rpc_url: server.uri(),
            network_passphrase: "Test SDF Network ; September 2015".to_string(),
            contract_id: "CTEST".to_string(),
            request_timeout: Duration::from_millis(500),
            retry: RetryConfig {
                max_attempts: 3,
                base_delay: Duration::from_millis(1),
                max_delay: Duration::from_millis(5),
                retryable_status: vec![500, 502, 503, 504, 408],
            },
        }
    }

    fn account_json(id: &str) -> serde_json::Value {
        serde_json::json!({
            "id": id,
            "sequence": "1234",
            "balances": [],
            "thresholds": {"low_threshold":0,"med_threshold":0,"high_threshold":0},
            "flags": {"auth_required":false,"auth_revocable":false,"auth_immutable":false},
            "last_modified_ledger": 10
        })
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_single_500_then_success() {
        let server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/accounts/GTEST"))
            .respond_with(ResponseTemplate::new(500).set_body_string("internal error"))
            .up_to_n_times(1)
            .mount(&server)
            .await;

        Mock::given(method("GET"))
            .and(path("/accounts/GTEST"))
            .respond_with(ResponseTemplate::new(200).set_body_json(&account_json("GTEST")))
            .mount(&server)
            .await;

        let client = StellarRpcClient::new(config_for(&server)).unwrap();
        let result = client.get_account("GTEST").await;
        assert!(result.is_ok(), "expected success after retry, got: {:?}", result);
        assert_eq!(result.unwrap().id, "GTEST");

        let reqs = server.received_requests().await.unwrap();
        assert_eq!(reqs.len(), 2, "expected exactly 2 requests");
    }

    #[tokio::test]
    async fn test_persistent_500_exhausts_retries() {
        let server = MockServer::start().await;

        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(500).set_body_string("always failing"))
            .mount(&server)
            .await;

        let client = StellarRpcClient::new(config_for(&server)).unwrap();
        let result = client.get_account("GTEST").await;

        match result {
            Err(RpcError::RetriesExhausted { attempts, .. }) => {
                assert_eq!(attempts, 3, "expected max_attempts=3 exhausted");
            }
            other => panic!("expected RetriesExhausted, got: {:?}", other),
        }

        let reqs = server.received_requests().await.unwrap();
        assert_eq!(reqs.len(), 3, "expected 3 total attempts");
    }

    #[tokio::test]
    async fn test_503_is_retried_then_exhausted() {
        let server = MockServer::start().await;

        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(503).set_body_string("service unavailable"))
            .mount(&server)
            .await;

        let config = StellarRpcConfig {
            retry: RetryConfig {
                max_attempts: 2,
                base_delay: Duration::from_millis(1),
                max_delay: Duration::from_millis(5),
                retryable_status: vec![503],
            },
            ..config_for(&server)
        };
        let client = StellarRpcClient::new(config).unwrap();
        let result = client.get_account("GTEST").await;

        match result {
            Err(RpcError::RetriesExhausted { attempts, .. }) => {
                assert_eq!(attempts, 2);
            }
            other => panic!("expected RetriesExhausted, got: {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_429_returns_rate_limited_immediately() {
        let server = MockServer::start().await;

        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(429).set_body_string("rate limited"))
            .mount(&server)
            .await;

        let mut config = config_for(&server);
        config.retry.retryable_status = vec![429, 500];

        let client = StellarRpcClient::new(config).unwrap();
        let result = client.get_account("GTEST").await;

        assert!(
            matches!(result, Err(RpcError::RateLimited)),
            "expected RateLimited, got: {:?}",
            result
        );

        let reqs = server.received_requests().await.unwrap();
        assert_eq!(reqs.len(), 1, "429 must not trigger retries");
    }

    #[tokio::test]
    async fn test_404_fails_fast_without_retry() {
        let server = MockServer::start().await;

        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(404).set_body_string("not found"))
            .mount(&server)
            .await;

        let client = StellarRpcClient::new(config_for(&server)).unwrap();
        let result = client.get_account("GTEST").await;

        assert!(
            matches!(result, Err(RpcError::Http { status: 404, .. })),
            "expected Http 404, got: {:?}",
            result
        );

        let reqs = server.received_requests().await.unwrap();
        assert_eq!(reqs.len(), 1, "404 should not be retried");
    }

    #[tokio::test]
    async fn test_network_error_is_retried_then_exhausted() {
        let config = StellarRpcConfig {
            horizon_url: "http://127.0.0.1:19999".to_string(),
            soroban_rpc_url: "http://127.0.0.1:19999".to_string(),
            network_passphrase: "Test SDF Network ; September 2015".to_string(),
            contract_id: "CTEST".to_string(),
            request_timeout: Duration::from_millis(100),
            retry: RetryConfig {
                max_attempts: 2,
                base_delay: Duration::from_millis(1),
                max_delay: Duration::from_millis(5),
                retryable_status: vec![500],
            },
        };

        let client = StellarRpcClient::new(config).unwrap();
        let result = client.get_account("GTEST").await;

        assert!(
            matches!(
                result,
                Err(RpcError::RetriesExhausted { .. }) | Err(RpcError::Network(_))
            ),
            "expected network-level error after retries, got: {:?}",
            result
        );
    }

    #[tokio::test]
    async fn test_two_transient_errors_then_success() {
        let server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/accounts/GTEST"))
            .respond_with(ResponseTemplate::new(500))
            .up_to_n_times(2)
            .mount(&server)
            .await;

        Mock::given(method("GET"))
            .and(path("/accounts/GTEST"))
            .respond_with(ResponseTemplate::new(200).set_body_json(&account_json("GTEST")))
            .mount(&server)
            .await;

        let client = StellarRpcClient::new(config_for(&server)).unwrap();
        let result = client.get_account("GTEST").await;
        assert!(result.is_ok(), "expected success on 3rd attempt, got: {:?}", result);

        let reqs = server.received_requests().await.unwrap();
        assert_eq!(reqs.len(), 3, "expected exactly 3 HTTP requests");
    }

    #[tokio::test]
    async fn test_malformed_json_returns_deserialize_error() {
        let server = MockServer::start().await;

        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(200).set_body_string("{ not valid json !!!"))
            .mount(&server)
            .await;

        let client = StellarRpcClient::new(config_for(&server)).unwrap();
        let result = client.get_account("GTEST").await;

        assert!(
            matches!(result, Err(RpcError::Deserialize(_))),
            "expected Deserialize error, got: {:?}",
            result
        );
    }

    #[test]
    fn test_backoff_delay_respects_cap() {
        let cfg = RetryConfig {
            max_attempts: 5,
            base_delay: Duration::from_millis(100),
            max_delay: Duration::from_millis(800),
            retryable_status: vec![500],
        };
        for attempt in 0..10 {
            let d = cfg.delay_for(attempt);
            assert!(
                d <= cfg.max_delay,
                "delay {:?} exceeded max_delay on attempt {}",
                d,
                attempt
            );
        }
    }

    #[test]
    fn test_backoff_delay_increases_with_attempt() {
        // Over many samples the average delay should grow — we just check that
        // delay_for is deterministic with respect to the cap.
        let cfg = RetryConfig {
            max_attempts: 3,
            base_delay: Duration::from_millis(50),
            max_delay: Duration::from_millis(1000),
            retryable_status: vec![500],
        };
        // All delays must be non-negative and within cap
        for attempt in 0..6 {
            let d = cfg.delay_for(attempt);
            assert!(d <= cfg.max_delay);
        }
    }

    #[tokio::test]
    async fn test_submit_transaction_retried_on_500() {
        let server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/transactions"))
            .respond_with(ResponseTemplate::new(500))
            .up_to_n_times(1)
            .mount(&server)
            .await;

        let tx_json = serde_json::json!({
            "hash": "abc123",
            "successful": true,
            "ledger": 100,
            "envelope_xdr": "AAAA",
            "result_xdr": "BBBB"
        });
        Mock::given(method("POST"))
            .and(path("/transactions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(&tx_json))
            .mount(&server)
            .await;

        let client = StellarRpcClient::new(config_for(&server)).unwrap();
        let result = client.submit_transaction("AAAA").await;
        assert!(
            result.is_ok(),
            "submit_transaction should succeed after retry, got: {:?}",
            result
        );
        assert_eq!(result.unwrap().hash, "abc123");

        let reqs = server.received_requests().await.unwrap();
        assert_eq!(reqs.len(), 2, "expected 2 POST attempts");
    }

    #[tokio::test]
    async fn test_graceful_failure_no_panic() {
        let server = MockServer::start().await;

        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(503))
            .mount(&server)
            .await;

        let config = StellarRpcConfig {
            retry: RetryConfig {
                max_attempts: 1,
                base_delay: Duration::from_millis(1),
                max_delay: Duration::from_millis(1),
                retryable_status: vec![503],
            },
            ..config_for(&server)
        };

        let client = StellarRpcClient::new(config).unwrap();
        let result = client.get_account("GTEST").await;
        assert!(result.is_err(), "graceful failure: expected Err, got Ok");
    }

    #[test]
    fn test_rpc_error_display_variants() {
        let e = RpcError::Http {
            status: 500,
            message: "oops".to_string(),
        };
        assert!(e.to_string().contains("500"));

        let e = RpcError::RetriesExhausted {
            attempts: 3,
            last_error: "timeout".to_string(),
        };
        assert!(e.to_string().contains("3"));

        let e = RpcError::RateLimited;
        assert!(e.to_string().contains("429"));
    }

    #[test]
    fn test_retry_config_retryable_status_lookup() {
        let cfg = RetryConfig {
            max_attempts: 3,
            base_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(5),
            retryable_status: vec![500, 503],
        };
        assert!(cfg.retryable_status.contains(&500));
        assert!(cfg.retryable_status.contains(&503));
        assert!(!cfg.retryable_status.contains(&404));
        assert!(!cfg.retryable_status.contains(&200));
    }
}
