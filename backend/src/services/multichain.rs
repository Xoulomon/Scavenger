use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum BlockchainNetwork {
    Stellar,
    Ethereum,
    Polygon,
    Arbitrum,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub network: BlockchainNetwork,
    pub rpc_url: String,
    pub contract_address: String,
    pub chain_id: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossChainTransaction {
    pub source_chain: BlockchainNetwork,
    pub target_chain: BlockchainNetwork,
    pub transaction_id: String,
    pub status: TransactionStatus,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum TransactionStatus {
    Pending,
    Confirmed,
    Failed,
}

pub struct ChainAbstraction;

impl ChainAbstraction {
    pub fn get_chain_config(network: BlockchainNetwork) -> ChainConfig {
        match network {
            BlockchainNetwork::Stellar => ChainConfig {
                network,
                rpc_url: "https://soroban-testnet.stellar.org".to_string(),
                contract_address: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4".to_string(),
                chain_id: 0,
            },
            BlockchainNetwork::Ethereum => ChainConfig {
                network,
                rpc_url: "https://eth-mainnet.g.alchemy.com/v2/demo".to_string(),
                contract_address: "0x0000000000000000000000000000000000000000".to_string(),
                chain_id: 1,
            },
            BlockchainNetwork::Polygon => ChainConfig {
                network,
                rpc_url: "https://polygon-rpc.com".to_string(),
                contract_address: "0x0000000000000000000000000000000000000000".to_string(),
                chain_id: 137,
            },
            BlockchainNetwork::Arbitrum => ChainConfig {
                network,
                rpc_url: "https://arb1.arbitrum.io/rpc".to_string(),
                contract_address: "0x0000000000000000000000000000000000000000".to_string(),
                chain_id: 42161,
            },
        }
    }

    pub fn create_cross_chain_transaction(
        source: BlockchainNetwork,
        target: BlockchainNetwork,
    ) -> CrossChainTransaction {
        CrossChainTransaction {
            source_chain: source,
            target_chain: target,
            transaction_id: Self::generate_tx_id(),
            status: TransactionStatus::Pending,
        }
    }

    fn generate_tx_id() -> String {
        format!("tx_{}", uuid::Uuid::new_v4())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── existing tests (preserved) ────────────────────────────────────────────

    #[test]
    fn test_get_stellar_config() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Stellar);
        assert_eq!(config.network, BlockchainNetwork::Stellar);
        assert!(!config.rpc_url.is_empty());
    }

    #[test]
    fn test_get_ethereum_config() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Ethereum);
        assert_eq!(config.network, BlockchainNetwork::Ethereum);
        assert_eq!(config.chain_id, 1);
    }

    #[test]
    fn test_get_polygon_config() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Polygon);
        assert_eq!(config.network, BlockchainNetwork::Polygon);
        assert_eq!(config.chain_id, 137);
    }

    #[test]
    fn test_create_cross_chain_transaction() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Ethereum,
        );
        assert_eq!(tx.source_chain, BlockchainNetwork::Stellar);
        assert_eq!(tx.target_chain, BlockchainNetwork::Ethereum);
        assert_eq!(tx.status, TransactionStatus::Pending);
    }

    #[test]
    fn test_transaction_id_generation() {
        let tx1 = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Polygon,
        );
        let tx2 = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Polygon,
        );
        assert_ne!(tx1.transaction_id, tx2.transaction_id);
    }

    // ── Arbitrum config ───────────────────────────────────────────────────────

    #[test]
    fn test_get_arbitrum_config() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Arbitrum);
        assert_eq!(config.network, BlockchainNetwork::Arbitrum);
        assert_eq!(config.chain_id, 42161);
        assert!(!config.rpc_url.is_empty());
        assert!(!config.contract_address.is_empty());
    }

    // ── chain_id correctness for every network ────────────────────────────────

    #[test]
    fn test_stellar_chain_id_is_zero() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Stellar);
        assert_eq!(config.chain_id, 0);
    }

    #[test]
    fn test_ethereum_chain_id() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Ethereum);
        assert_eq!(config.chain_id, 1);
    }

    #[test]
    fn test_polygon_chain_id() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Polygon);
        assert_eq!(config.chain_id, 137);
    }

    #[test]
    fn test_arbitrum_chain_id() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Arbitrum);
        assert_eq!(config.chain_id, 42161);
    }

    // ── rpc_url non-empty for every network ───────────────────────────────────

    #[test]
    fn test_all_networks_have_non_empty_rpc_url() {
        let networks = [
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Ethereum,
            BlockchainNetwork::Polygon,
            BlockchainNetwork::Arbitrum,
        ];
        for network in networks {
            let config = ChainAbstraction::get_chain_config(network);
            assert!(!config.rpc_url.is_empty(), "rpc_url empty for {network:?}");
        }
    }

    // ── contract_address non-empty for every network ──────────────────────────

    #[test]
    fn test_all_networks_have_non_empty_contract_address() {
        let networks = [
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Ethereum,
            BlockchainNetwork::Polygon,
            BlockchainNetwork::Arbitrum,
        ];
        for network in networks {
            let config = ChainAbstraction::get_chain_config(network);
            assert!(
                !config.contract_address.is_empty(),
                "contract_address empty for {network:?}"
            );
        }
    }

    // ── specific rpc_url values ───────────────────────────────────────────────

    #[test]
    fn test_stellar_rpc_url() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Stellar);
        assert_eq!(config.rpc_url, "https://soroban-testnet.stellar.org");
    }

    #[test]
    fn test_ethereum_rpc_url() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Ethereum);
        assert_eq!(config.rpc_url, "https://eth-mainnet.g.alchemy.com/v2/demo");
    }

    #[test]
    fn test_polygon_rpc_url() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Polygon);
        assert_eq!(config.rpc_url, "https://polygon-rpc.com");
    }

    #[test]
    fn test_arbitrum_rpc_url() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Arbitrum);
        assert_eq!(config.rpc_url, "https://arb1.arbitrum.io/rpc");
    }

    // ── TransactionStatus enum variants ──────────────────────────────────────

    #[test]
    fn test_transaction_status_pending() {
        let status = TransactionStatus::Pending;
        assert_eq!(status, TransactionStatus::Pending);
        assert_ne!(status, TransactionStatus::Confirmed);
        assert_ne!(status, TransactionStatus::Failed);
    }

    #[test]
    fn test_transaction_status_confirmed() {
        let status = TransactionStatus::Confirmed;
        assert_eq!(status, TransactionStatus::Confirmed);
        assert_ne!(status, TransactionStatus::Pending);
        assert_ne!(status, TransactionStatus::Failed);
    }

    #[test]
    fn test_transaction_status_failed() {
        let status = TransactionStatus::Failed;
        assert_eq!(status, TransactionStatus::Failed);
        assert_ne!(status, TransactionStatus::Pending);
        assert_ne!(status, TransactionStatus::Confirmed);
    }

    #[test]
    fn test_transaction_status_copy() {
        let s = TransactionStatus::Confirmed;
        let s2 = s; // Copy
        assert_eq!(s, s2);
    }

    // ── BlockchainNetwork enum variants ──────────────────────────────────────

    #[test]
    fn test_blockchain_network_equality() {
        assert_eq!(BlockchainNetwork::Stellar, BlockchainNetwork::Stellar);
        assert_eq!(BlockchainNetwork::Ethereum, BlockchainNetwork::Ethereum);
        assert_eq!(BlockchainNetwork::Polygon, BlockchainNetwork::Polygon);
        assert_eq!(BlockchainNetwork::Arbitrum, BlockchainNetwork::Arbitrum);
    }

    #[test]
    fn test_blockchain_network_inequality() {
        assert_ne!(BlockchainNetwork::Stellar, BlockchainNetwork::Ethereum);
        assert_ne!(BlockchainNetwork::Polygon, BlockchainNetwork::Arbitrum);
    }

    #[test]
    fn test_blockchain_network_copy() {
        let n = BlockchainNetwork::Polygon;
        let n2 = n; // Copy
        assert_eq!(n, n2);
    }

    // ── ChainConfig struct serialization / deserialization ────────────────────

    #[test]
    fn test_chain_config_serialization_stellar() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Stellar);
        let json = serde_json::to_string(&config).expect("serialization failed");
        assert!(json.contains("Stellar"));
        assert!(json.contains("soroban-testnet.stellar.org"));
    }

    #[test]
    fn test_chain_config_deserialization() {
        let json = r#"{
            "network": "Ethereum",
            "rpc_url": "https://example.com",
            "contract_address": "0xABCD",
            "chain_id": 1
        }"#;
        let config: ChainConfig = serde_json::from_str(json).expect("deserialization failed");
        assert_eq!(config.network, BlockchainNetwork::Ethereum);
        assert_eq!(config.rpc_url, "https://example.com");
        assert_eq!(config.contract_address, "0xABCD");
        assert_eq!(config.chain_id, 1);
    }

    #[test]
    fn test_chain_config_round_trip() {
        let original = ChainAbstraction::get_chain_config(BlockchainNetwork::Polygon);
        let json = serde_json::to_string(&original).expect("serialization failed");
        let restored: ChainConfig = serde_json::from_str(&json).expect("deserialization failed");
        assert_eq!(restored.network, original.network);
        assert_eq!(restored.rpc_url, original.rpc_url);
        assert_eq!(restored.contract_address, original.contract_address);
        assert_eq!(restored.chain_id, original.chain_id);
    }

    #[test]
    fn test_chain_config_clone() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Arbitrum);
        let cloned = config.clone();
        assert_eq!(cloned.network, config.network);
        assert_eq!(cloned.rpc_url, config.rpc_url);
        assert_eq!(cloned.chain_id, config.chain_id);
    }

    // ── CrossChainTransaction serialization / deserialization ─────────────────

    #[test]
    fn test_cross_chain_transaction_serialization() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Ethereum,
        );
        let json = serde_json::to_string(&tx).expect("serialization failed");
        assert!(json.contains("Stellar"));
        assert!(json.contains("Ethereum"));
        assert!(json.contains("Pending"));
        assert!(json.contains("tx_"));
    }

    #[test]
    fn test_cross_chain_transaction_deserialization() {
        let json = r#"{
            "source_chain": "Polygon",
            "target_chain": "Arbitrum",
            "transaction_id": "tx_abc123",
            "status": "Confirmed"
        }"#;
        let tx: CrossChainTransaction =
            serde_json::from_str(json).expect("deserialization failed");
        assert_eq!(tx.source_chain, BlockchainNetwork::Polygon);
        assert_eq!(tx.target_chain, BlockchainNetwork::Arbitrum);
        assert_eq!(tx.transaction_id, "tx_abc123");
        assert_eq!(tx.status, TransactionStatus::Confirmed);
    }

    #[test]
    fn test_cross_chain_transaction_round_trip() {
        let original = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Arbitrum,
            BlockchainNetwork::Polygon,
        );
        let json = serde_json::to_string(&original).expect("serialization failed");
        let restored: CrossChainTransaction =
            serde_json::from_str(&json).expect("deserialization failed");
        assert_eq!(restored.source_chain, original.source_chain);
        assert_eq!(restored.target_chain, original.target_chain);
        assert_eq!(restored.transaction_id, original.transaction_id);
        assert_eq!(restored.status, original.status);
    }

    #[test]
    fn test_cross_chain_transaction_clone() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Ethereum,
            BlockchainNetwork::Polygon,
        );
        let cloned = tx.clone();
        assert_eq!(cloned.source_chain, tx.source_chain);
        assert_eq!(cloned.target_chain, tx.target_chain);
        assert_eq!(cloned.transaction_id, tx.transaction_id);
        assert_eq!(cloned.status, tx.status);
    }

    // ── BlockchainNetwork serialization / deserialization ─────────────────────

    #[test]
    fn test_blockchain_network_serialization() {
        let networks = [
            (BlockchainNetwork::Stellar, "\"Stellar\""),
            (BlockchainNetwork::Ethereum, "\"Ethereum\""),
            (BlockchainNetwork::Polygon, "\"Polygon\""),
            (BlockchainNetwork::Arbitrum, "\"Arbitrum\""),
        ];
        for (network, expected_json) in networks {
            let json = serde_json::to_string(&network).expect("serialization failed");
            assert_eq!(json, expected_json, "serialization mismatch for {network:?}");
        }
    }

    #[test]
    fn test_blockchain_network_deserialization() {
        let cases = [
            ("\"Stellar\"", BlockchainNetwork::Stellar),
            ("\"Ethereum\"", BlockchainNetwork::Ethereum),
            ("\"Polygon\"", BlockchainNetwork::Polygon),
            ("\"Arbitrum\"", BlockchainNetwork::Arbitrum),
        ];
        for (json, expected) in cases {
            let network: BlockchainNetwork =
                serde_json::from_str(json).expect("deserialization failed");
            assert_eq!(network, expected);
        }
    }

    // ── TransactionStatus serialization / deserialization ────────────────────

    #[test]
    fn test_transaction_status_serialization() {
        let cases = [
            (TransactionStatus::Pending, "\"Pending\""),
            (TransactionStatus::Confirmed, "\"Confirmed\""),
            (TransactionStatus::Failed, "\"Failed\""),
        ];
        for (status, expected_json) in cases {
            let json = serde_json::to_string(&status).expect("serialization failed");
            assert_eq!(json, expected_json, "serialization mismatch for {status:?}");
        }
    }

    #[test]
    fn test_transaction_status_deserialization() {
        let cases = [
            ("\"Pending\"", TransactionStatus::Pending),
            ("\"Confirmed\"", TransactionStatus::Confirmed),
            ("\"Failed\"", TransactionStatus::Failed),
        ];
        for (json, expected) in cases {
            let status: TransactionStatus =
                serde_json::from_str(json).expect("deserialization failed");
            assert_eq!(status, expected);
        }
    }

    // ── same-chain transactions ───────────────────────────────────────────────

    #[test]
    fn test_same_chain_transaction_stellar() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Stellar,
        );
        assert_eq!(tx.source_chain, BlockchainNetwork::Stellar);
        assert_eq!(tx.target_chain, BlockchainNetwork::Stellar);
        assert_eq!(tx.status, TransactionStatus::Pending);
        assert!(tx.transaction_id.starts_with("tx_"));
    }

    #[test]
    fn test_same_chain_transaction_ethereum() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Ethereum,
            BlockchainNetwork::Ethereum,
        );
        assert_eq!(tx.source_chain, BlockchainNetwork::Ethereum);
        assert_eq!(tx.target_chain, BlockchainNetwork::Ethereum);
    }

    #[test]
    fn test_same_chain_transaction_polygon() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Polygon,
            BlockchainNetwork::Polygon,
        );
        assert_eq!(tx.source_chain, BlockchainNetwork::Polygon);
        assert_eq!(tx.target_chain, BlockchainNetwork::Polygon);
    }

    #[test]
    fn test_same_chain_transaction_arbitrum() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Arbitrum,
            BlockchainNetwork::Arbitrum,
        );
        assert_eq!(tx.source_chain, BlockchainNetwork::Arbitrum);
        assert_eq!(tx.target_chain, BlockchainNetwork::Arbitrum);
    }

    // ── all cross-chain combinations ──────────────────────────────────────────

    #[test]
    fn test_all_cross_chain_combinations() {
        let networks = [
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Ethereum,
            BlockchainNetwork::Polygon,
            BlockchainNetwork::Arbitrum,
        ];
        for &source in &networks {
            for &target in &networks {
                let tx =
                    ChainAbstraction::create_cross_chain_transaction(source, target);
                assert_eq!(tx.source_chain, source);
                assert_eq!(tx.target_chain, target);
                assert_eq!(tx.status, TransactionStatus::Pending);
                assert!(
                    tx.transaction_id.starts_with("tx_"),
                    "tx_id wrong format for {source:?}->{target:?}: {}",
                    tx.transaction_id
                );
            }
        }
    }

    // ── generate_tx_id format and uniqueness ─────────────────────────────────

    #[test]
    fn test_transaction_id_starts_with_tx_prefix() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Ethereum,
        );
        assert!(
            tx.transaction_id.starts_with("tx_"),
            "transaction_id does not start with 'tx_': {}",
            tx.transaction_id
        );
    }

    #[test]
    fn test_transaction_id_contains_valid_uuid() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Ethereum,
        );
        // Format: "tx_<uuid-v4>" — strip prefix and parse UUID
        let uuid_part = tx
            .transaction_id
            .strip_prefix("tx_")
            .expect("missing 'tx_' prefix");
        uuid::Uuid::parse_str(uuid_part).expect("not a valid UUID after prefix");
    }

    #[test]
    fn test_transaction_ids_are_unique() {
        // Generate 10 IDs and confirm all are distinct
        let mut ids: Vec<String> = (0..10)
            .map(|_| {
                ChainAbstraction::create_cross_chain_transaction(
                    BlockchainNetwork::Stellar,
                    BlockchainNetwork::Ethereum,
                )
                .transaction_id
            })
            .collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), 10, "duplicate transaction IDs detected");
    }

    // ── CrossChainTransaction struct field access ─────────────────────────────

    #[test]
    fn test_cross_chain_transaction_fields_stellar_to_polygon() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Polygon,
        );
        assert_eq!(tx.source_chain, BlockchainNetwork::Stellar);
        assert_eq!(tx.target_chain, BlockchainNetwork::Polygon);
        assert_eq!(tx.status, TransactionStatus::Pending);
        assert!(!tx.transaction_id.is_empty());
    }

    #[test]
    fn test_cross_chain_transaction_fields_ethereum_to_arbitrum() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Ethereum,
            BlockchainNetwork::Arbitrum,
        );
        assert_eq!(tx.source_chain, BlockchainNetwork::Ethereum);
        assert_eq!(tx.target_chain, BlockchainNetwork::Arbitrum);
        assert_eq!(tx.status, TransactionStatus::Pending);
    }

    #[test]
    fn test_cross_chain_transaction_initial_status_is_always_pending() {
        let pairs = [
            (BlockchainNetwork::Stellar, BlockchainNetwork::Ethereum),
            (BlockchainNetwork::Polygon, BlockchainNetwork::Arbitrum),
            (BlockchainNetwork::Ethereum, BlockchainNetwork::Stellar),
        ];
        for (src, tgt) in pairs {
            let tx = ChainAbstraction::create_cross_chain_transaction(src, tgt);
            assert_eq!(
                tx.status,
                TransactionStatus::Pending,
                "initial status should be Pending for {src:?}->{tgt:?}"
            );
        }
    }

    // ── ChainConfig network field mirrors the requested network ──────────────

    #[test]
    fn test_chain_config_network_field_matches_requested_network() {
        let networks = [
            BlockchainNetwork::Stellar,
            BlockchainNetwork::Ethereum,
            BlockchainNetwork::Polygon,
            BlockchainNetwork::Arbitrum,
        ];
        for network in networks {
            let config = ChainAbstraction::get_chain_config(network);
            assert_eq!(
                config.network, network,
                "config.network mismatch for {network:?}"
            );
        }
    }

    // ── Debug formatting (exercises #[derive(Debug)]) ─────────────────────────

    #[test]
    fn test_debug_formatting_blockchain_network() {
        assert_eq!(format!("{:?}", BlockchainNetwork::Stellar), "Stellar");
        assert_eq!(format!("{:?}", BlockchainNetwork::Ethereum), "Ethereum");
        assert_eq!(format!("{:?}", BlockchainNetwork::Polygon), "Polygon");
        assert_eq!(format!("{:?}", BlockchainNetwork::Arbitrum), "Arbitrum");
    }

    #[test]
    fn test_debug_formatting_transaction_status() {
        assert_eq!(format!("{:?}", TransactionStatus::Pending), "Pending");
        assert_eq!(format!("{:?}", TransactionStatus::Confirmed), "Confirmed");
        assert_eq!(format!("{:?}", TransactionStatus::Failed), "Failed");
    }

    #[test]
    fn test_debug_formatting_chain_config() {
        let config = ChainAbstraction::get_chain_config(BlockchainNetwork::Stellar);
        let debug_str = format!("{config:?}");
        assert!(debug_str.contains("ChainConfig"));
        assert!(debug_str.contains("Stellar"));
    }

    #[test]
    fn test_debug_formatting_cross_chain_transaction() {
        let tx = ChainAbstraction::create_cross_chain_transaction(
            BlockchainNetwork::Ethereum,
            BlockchainNetwork::Polygon,
        );
        let debug_str = format!("{tx:?}");
        assert!(debug_str.contains("CrossChainTransaction"));
        assert!(debug_str.contains("Ethereum"));
        assert!(debug_str.contains("Polygon"));
    }
}
