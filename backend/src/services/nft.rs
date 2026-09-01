use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NFTCertificate {
    pub token_id: String,
    pub participant_id: String,
    pub waste_type: String,
    pub weight: u128,
    pub timestamp: u64,
    pub metadata_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NFTMintRequest {
    pub participant_id: String,
    pub waste_type: String,
    pub weight: u128,
}

pub struct NFTManager;

impl NFTManager {
    pub fn mint_certificate(request: NFTMintRequest) -> NFTCertificate {
        let token_id = Self::generate_token_id(&request.participant_id);
        let timestamp = Self::current_timestamp();

        NFTCertificate {
            token_id,
            participant_id: request.participant_id,
            waste_type: request.waste_type,
            weight: request.weight,
            timestamp,
            metadata_uri: format!("ipfs://metadata/{}", timestamp),
        }
    }

    pub fn verify_certificate(certificate: &NFTCertificate) -> bool {
        !certificate.token_id.is_empty() && !certificate.participant_id.is_empty() && certificate.weight > 0
    }

    fn generate_token_id(participant_id: &str) -> String {
        format!("nft_{}", participant_id)
    }

    fn current_timestamp() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── helpers ────────────────────────────────────────────────────────────────

    /// Build a valid NFTMintRequest with sensible defaults.
    fn valid_mint_request() -> NFTMintRequest {
        NFTMintRequest {
            participant_id: "recycler_001".to_string(),
            waste_type: "plastic".to_string(),
            weight: 500,
        }
    }

    /// Build a fully-populated NFTCertificate (not minted – all fields set manually).
    fn valid_certificate() -> NFTCertificate {
        NFTCertificate {
            token_id: "nft_recycler_001".to_string(),
            participant_id: "recycler_001".to_string(),
            waste_type: "plastic".to_string(),
            weight: 500,
            timestamp: 1_700_000_000,
            metadata_uri: "ipfs://metadata/1700000000".to_string(),
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // A. Valid mint paths
    // ══════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_mint_certificate_basic() {
        let request = valid_mint_request();
        let cert = NFTManager::mint_certificate(request.clone());

        assert!(!cert.token_id.is_empty(), "token_id must not be empty");
        assert_eq!(cert.participant_id, "recycler_001");
        assert_eq!(cert.waste_type, "plastic");
        assert_eq!(cert.weight, 500);
    }

    #[test]
    fn test_mint_certificate_minimal_valid_request() {
        let request = NFTMintRequest {
            participant_id: "a".to_string(),
            waste_type: "b".to_string(),
            weight: 1,
        };
        let cert = NFTManager::mint_certificate(request);

        assert_eq!(cert.participant_id, "a");
        assert_eq!(cert.waste_type, "b");
        assert_eq!(cert.weight, 1);
        assert!(!cert.token_id.is_empty());
    }

    #[test]
    fn test_mint_certificate_large_weight() {
        let request = NFTMintRequest {
            participant_id: "user1".to_string(),
            waste_type: "metal".to_string(),
            weight: u128::MAX,
        };
        let cert = NFTManager::mint_certificate(request);
        assert_eq!(cert.weight, u128::MAX);
    }

    #[test]
    fn test_mint_certificate_zero_weight() {
        let request = NFTMintRequest {
            participant_id: "user1".to_string(),
            waste_type: "glass".to_string(),
            weight: 0,
        };
        let cert = NFTManager::mint_certificate(request);
        assert_eq!(cert.weight, 0);
    }

    #[test]
    fn test_mint_certificate_empty_waste_type() {
        let request = NFTMintRequest {
            participant_id: "user1".to_string(),
            waste_type: String::new(),
            weight: 100,
        };
        let cert = NFTManager::mint_certificate(request);
        assert_eq!(cert.waste_type, "");
    }

    #[test]
    fn test_mint_certificate_empty_participant_id() {
        let request = NFTMintRequest {
            participant_id: String::new(),
            waste_type: "plastic".to_string(),
            weight: 100,
        };
        // mint_certificate itself does not validate – it produces a cert
        let cert = NFTManager::mint_certificate(request);
        assert_eq!(cert.participant_id, "");
        assert_eq!(cert.token_id, "nft_");
    }

    #[test]
    fn test_mint_certificate_special_characters_in_participant_id() {
        let request = NFTMintRequest {
            participant_id: "user/with spaces&special=chars".to_string(),
            waste_type: "organic".to_string(),
            weight: 250,
        };
        let cert = NFTManager::mint_certificate(request);
        assert_eq!(
            cert.token_id, "nft_user/with spaces&special=chars",
            "token_id should embed the participant_id verbatim"
        );
    }

    #[test]
    fn test_mint_certificate_long_strings() {
        let long_id = "x".repeat(10_000);
        let long_type = "y".repeat(10_000);
        let request = NFTMintRequest {
            participant_id: long_id.clone(),
            waste_type: long_type.clone(),
            weight: 999,
        };
        let cert = NFTManager::mint_certificate(request);
        assert_eq!(cert.participant_id, long_id);
        assert_eq!(cert.waste_type, long_type);
        assert!(cert.token_id.starts_with("nft_"));
    }

    #[test]
    fn test_mint_certificate_metadata_uri_format() {
        let request = valid_mint_request();
        let before_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let cert = NFTManager::mint_certificate(request);
        let after_ts = before_ts + 5; // allow 5s slack

        assert!(
            cert.metadata_uri.starts_with("ipfs://metadata/"),
            "metadata_uri must start with ipfs://metadata/, got: {}",
            cert.metadata_uri
        );
        // Extract timestamp from URI
        let ts_str = cert.metadata_uri.trim_start_matches("ipfs://metadata/");
        let ts: u64 = ts_str.parse().expect("metadata_uri timestamp must be a valid u64");
        assert!(
            ts >= before_ts && ts <= after_ts,
            "URI timestamp {ts} should be between {before_ts} and {after_ts}"
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // B. Token-id generation
    // ══════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_token_id_prefix() {
        let request = valid_mint_request();
        let cert = NFTManager::mint_certificate(request);
        assert!(
            cert.token_id.starts_with("nft_"),
            "token_id must start with 'nft_', got: {}",
            cert.token_id
        );
    }

    #[test]
    fn test_token_id_contains_participant_id() {
        let request = NFTMintRequest {
            participant_id: "abc123".to_string(),
            waste_type: "plastic".to_string(),
            weight: 10,
        };
        let cert = NFTManager::mint_certificate(request);
        assert_eq!(cert.token_id, "nft_abc123");
    }

    #[test]
    fn test_generate_token_id_empty_participant() {
        let token_id = NFTManager::generate_token_id("");
        assert_eq!(token_id, "nft_");
    }

    #[test]
    fn test_generate_token_id_various_inputs() {
        let cases = vec![
            ("alice", "nft_alice"),
            ("0xdeadbeef", "nft_0xdeadbeef"),
            ("user with spaces", "nft_user with spaces"),
            ("", "nft_"),
        ];
        for (input, expected) in cases {
            let result = NFTManager::generate_token_id(input);
            assert_eq!(
                result, expected,
                "generate_token_id({input:?}) should return {expected:?}"
            );
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // C. verify_certificate – valid paths
    // ══════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_verify_certificate_valid() {
        let cert = valid_certificate();
        assert!(NFTManager::verify_certificate(&cert));
    }

    #[test]
    fn test_verify_certificate_minimal_valid() {
        let cert = NFTCertificate {
            token_id: "nft_1".to_string(),
            participant_id: "u".to_string(),
            waste_type: String::new(), // waste_type not validated
            weight: 1,
            timestamp: 0,
            metadata_uri: String::new(),
        };
        assert!(
            NFTManager::verify_certificate(&cert),
            "certificate with non-empty token_id, non-empty participant_id, weight>0 should be valid"
        );
    }

    #[test]
    fn test_verify_certificate_large_weight() {
        let cert = NFTCertificate {
            weight: u128::MAX,
            ..valid_certificate()
        };
        assert!(NFTManager::verify_certificate(&cert));
    }

    #[test]
    fn test_verify_certificate_minted_cert() {
        let request = valid_mint_request();
        let cert = NFTManager::mint_certificate(request);
        assert!(
            NFTManager::verify_certificate(&cert),
            "a freshly minted certificate with non-empty fields should be valid"
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // D. verify_certificate – invalid paths
    // ══════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_verify_certificate_empty_token_id() {
        let cert = NFTCertificate {
            token_id: String::new(),
            ..valid_certificate()
        };
        assert!(
            !NFTManager::verify_certificate(&cert),
            "empty token_id should fail verification"
        );
    }

    #[test]
    fn test_verify_certificate_empty_participant_id() {
        let cert = NFTCertificate {
            participant_id: String::new(),
            ..valid_certificate()
        };
        assert!(
            !NFTManager::verify_certificate(&cert),
            "empty participant_id should fail verification"
        );
    }

    #[test]
    fn test_verify_certificate_zero_weight() {
        let cert = NFTCertificate {
            weight: 0,
            ..valid_certificate()
        };
        assert!(
            !NFTManager::verify_certificate(&cert),
            "zero weight should fail verification"
        );
    }

    #[test]
    fn test_verify_certificate_empty_token_id_and_zero_weight() {
        let cert = NFTCertificate {
            token_id: String::new(),
            weight: 0,
            ..valid_certificate()
        };
        assert!(!NFTManager::verify_certificate(&cert));
    }

    #[test]
    fn test_verify_certificate_empty_all_required_fields() {
        let cert = NFTCertificate {
            token_id: String::new(),
            participant_id: String::new(),
            weight: 0,
            ..valid_certificate()
        };
        assert!(!NFTManager::verify_certificate(&cert));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // E. Timestamp
    // ══════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_current_timestamp_is_reasonable() {
        let ts = NFTManager::current_timestamp();
        // Should be after 2020-01-01 (1577836800) and before far future
        assert!(ts > 1_577_836_800, "timestamp {ts} should be after 2020-01-01");
        assert!(ts < 4_000_000_000, "timestamp {ts} should be before year 2096");
    }

    #[test]
    fn test_mint_certificate_timestamp_is_set() {
        let before = NFTManager::current_timestamp();
        let request = valid_mint_request();
        let cert = NFTManager::mint_certificate(request);
        let after = NFTManager::current_timestamp();

        assert!(
            cert.timestamp >= before && cert.timestamp <= after,
            "certificate timestamp {} should be between {before} and {after}",
            cert.timestamp
        );
    }

    #[test]
    fn test_timestamps_are_monotonically_non_decreasing() {
        let request = valid_mint_request();
        let mut prev_ts = 0;
        for _ in 0..5 {
            let cert = NFTManager::mint_certificate(request.clone());
            assert!(
                cert.timestamp >= prev_ts,
                "timestamp {} should be >= previous {}",
                cert.timestamp,
                prev_ts
            );
            prev_ts = cert.timestamp;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // F. Serialization / Deserialization
    // ══════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_nft_certificate_serialization_round_trip() {
        let original = valid_certificate();
        let json = serde_json::to_string(&original).expect("NFTCertificate serialization failed");
        let restored: NFTCertificate = serde_json::from_str(&json).expect("NFTCertificate deserialization failed");

        assert_eq!(restored.token_id, original.token_id);
        assert_eq!(restored.participant_id, original.participant_id);
        assert_eq!(restored.waste_type, original.waste_type);
        assert_eq!(restored.weight, original.weight);
        assert_eq!(restored.timestamp, original.timestamp);
        assert_eq!(restored.metadata_uri, original.metadata_uri);
    }

    #[test]
    fn test_nft_mint_request_serialization_round_trip() {
        let original = valid_mint_request();
        let json = serde_json::to_string(&original).expect("NFTMintRequest serialization failed");
        let restored: NFTMintRequest = serde_json::from_str(&json).expect("NFTMintRequest deserialization failed");

        assert_eq!(restored.participant_id, original.participant_id);
        assert_eq!(restored.waste_type, original.waste_type);
        assert_eq!(restored.weight, original.weight);
    }

    #[test]
    fn test_nft_certificate_json_format() {
        let cert = valid_certificate();
        let json = serde_json::to_value(&cert).unwrap();

        assert!(json.get("token_id").is_some(), "JSON must contain token_id");
        assert!(json.get("participant_id").is_some(), "JSON must contain participant_id");
        assert!(json.get("waste_type").is_some(), "JSON must contain waste_type");
        assert!(json.get("weight").is_some(), "JSON must contain weight");
        assert!(json.get("timestamp").is_some(), "JSON must contain timestamp");
        assert!(json.get("metadata_uri").is_some(), "JSON must contain metadata_uri");

        assert_eq!(json["token_id"], "nft_recycler_001");
        assert_eq!(json["participant_id"], "recycler_001");
        assert_eq!(json["waste_type"], "plastic");
        assert_eq!(json["weight"], 500);
    }

    #[test]
    fn test_nft_mint_request_json_format() {
        let req = valid_mint_request();
        let json = serde_json::to_value(&req).unwrap();

        assert!(json.get("participant_id").is_some(), "JSON must contain participant_id");
        assert!(json.get("waste_type").is_some(), "JSON must contain waste_type");
        assert!(json.get("weight").is_some(), "JSON must contain weight");

        assert_eq!(json["participant_id"], "recycler_001");
        assert_eq!(json["waste_type"], "plastic");
        assert_eq!(json["weight"], 500);
    }

    #[test]
    fn test_nft_certificate_deserialization_from_raw_json() {
        let json = r#"{
            "token_id": "nft_test_999",
            "participant_id": "user_alpha",
            "waste_type": "glass",
            "weight": 1234,
            "timestamp": 1700000000,
            "metadata_uri": "ipfs://metadata/1700000000"
        }"#;
        let cert: NFTCertificate = serde_json::from_str(json).expect("deserialization failed");

        assert_eq!(cert.token_id, "nft_test_999");
        assert_eq!(cert.participant_id, "user_alpha");
        assert_eq!(cert.waste_type, "glass");
        assert_eq!(cert.weight, 1234);
        assert_eq!(cert.timestamp, 1_700_000_000);
        assert_eq!(cert.metadata_uri, "ipfs://metadata/1700000000");
    }

    #[test]
    fn test_nft_mint_request_deserialization_from_raw_json() {
        let json = r#"{
            "participant_id": "user_beta",
            "waste_type": "metal",
            "weight": 777
        }"#;
        let req: NFTMintRequest = serde_json::from_str(json).expect("deserialization failed");

        assert_eq!(req.participant_id, "user_beta");
        assert_eq!(req.waste_type, "metal");
        assert_eq!(req.weight, 777);
    }

    #[test]
    fn test_nft_certificate_deserialization_missing_field() {
        let json = r#"{
            "token_id": "nft_123",
            "participant_id": "user1"
        }"#;
        let result: Result<NFTCertificate, _> = serde_json::from_str(json);
        assert!(
            result.is_err(),
            "deserialization should fail when required fields are missing"
        );
    }

    #[test]
    fn test_nft_mint_request_deserialization_missing_field() {
        let json = r#"{
            "participant_id": "user1"
        }"#;
        let result: Result<NFTMintRequest, _> = serde_json::from_str(json);
        assert!(
            result.is_err(),
            "deserialization should fail when required fields are missing"
        );
    }

    #[test]
    fn test_nft_certificate_deserialization_wrong_type() {
        let json = r#"{
            "token_id": 12345,
            "participant_id": "user1",
            "waste_type": "plastic",
            "weight": 100,
            "timestamp": 1700000000,
            "metadata_uri": "ipfs://metadata/1700000000"
        }"#;
        let result: Result<NFTCertificate, _> = serde_json::from_str(json);
        assert!(
            result.is_err(),
            "deserialization should fail when field types are wrong"
        );
    }

    #[test]
    fn test_nft_mint_request_weight_deserialization_as_string() {
        let json = r#"{
            "participant_id": "user1",
            "waste_type": "plastic",
            "weight": "not_a_number"
        }"#;
        let result: Result<NFTMintRequest, _> = serde_json::from_str(json);
        assert!(
            result.is_err(),
            "deserialization should fail when weight is a non-numeric string"
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // G. Debug / Clone / PartialEq
    // ══════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_debug_formatting_nft_certificate() {
        let cert = valid_certificate();
        let debug_str = format!("{cert:?}");
        assert!(debug_str.contains("NFTCertificate"));
        assert!(debug_str.contains("nft_recycler_001"));
        assert!(debug_str.contains("plastic"));
    }

    #[test]
    fn test_debug_formatting_nft_mint_request() {
        let req = valid_mint_request();
        let debug_str = format!("{req:?}");
        assert!(debug_str.contains("NFTMintRequest"));
        assert!(debug_str.contains("recycler_001"));
        assert!(debug_str.contains("plastic"));
    }

    #[test]
    fn test_nft_certificate_clone() {
        let original = valid_certificate();
        let cloned = original.clone();
        assert_eq!(cloned.token_id, original.token_id);
        assert_eq!(cloned.participant_id, original.participant_id);
        assert_eq!(cloned.waste_type, original.waste_type);
        assert_eq!(cloned.weight, original.weight);
        assert_eq!(cloned.timestamp, original.timestamp);
        assert_eq!(cloned.metadata_uri, original.metadata_uri);
    }

    #[test]
    fn test_nft_mint_request_clone() {
        let original = valid_mint_request();
        let cloned = original.clone();
        assert_eq!(cloned.participant_id, original.participant_id);
        assert_eq!(cloned.waste_type, original.waste_type);
        assert_eq!(cloned.weight, original.weight);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // H. Edge cases and boundary conditions
    // ══════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_mint_then_verify_round_trip() {
        let request = valid_mint_request();
        let cert = NFTManager::mint_certificate(request);
        assert!(
            NFTManager::verify_certificate(&cert),
            "freshly minted cert should be verifiable"
        );
    }

    #[test]
    fn test_mint_certificate_preserves_all_request_fields() {
        let request = NFTMintRequest {
            participant_id: "p123".to_string(),
            waste_type: "hazardous".to_string(),
            weight: 42,
        };
        let cert = NFTManager::mint_certificate(request);
        assert_eq!(cert.participant_id, "p123");
        assert_eq!(cert.waste_type, "hazardous");
        assert_eq!(cert.weight, 42);
    }

    #[test]
    fn test_verify_certificate_only_checks_three_fields() {
        // waste_type, timestamp, and metadata_uri are not validated
        let cert = NFTCertificate {
            token_id: "nft_x".to_string(),
            participant_id: "user_x".to_string(),
            waste_type: String::new(),
            weight: 1,
            timestamp: 0,
            metadata_uri: String::new(),
        };
        assert!(NFTManager::verify_certificate(&cert));
    }

    #[test]
    fn test_verify_certificate_fails_when_only_token_id_empty() {
        let cert = NFTCertificate {
            token_id: String::new(),
            participant_id: "user_x".to_string(),
            waste_type: "plastic".to_string(),
            weight: 100,
            timestamp: 12345,
            metadata_uri: "ipfs://x".to_string(),
        };
        assert!(!NFTManager::verify_certificate(&cert));
    }

    #[test]
    fn test_verify_certificate_fails_when_only_participant_id_empty() {
        let cert = NFTCertificate {
            token_id: "nft_x".to_string(),
            participant_id: String::new(),
            waste_type: "plastic".to_string(),
            weight: 100,
            timestamp: 12345,
            metadata_uri: "ipfs://x".to_string(),
        };
        assert!(!NFTManager::verify_certificate(&cert));
    }

    #[test]
    fn test_verify_certificate_fails_when_only_weight_zero() {
        let cert = NFTCertificate {
            token_id: "nft_x".to_string(),
            participant_id: "user_x".to_string(),
            waste_type: "plastic".to_string(),
            weight: 0,
            timestamp: 12345,
            metadata_uri: "ipfs://x".to_string(),
        };
        assert!(!NFTManager::verify_certificate(&cert));
    }
}
