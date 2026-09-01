use scavenger_backend::services::{
    ArchivalService, RetentionPolicy, ArchiveQuery, ArchiveStatus,
    StorageTier, FileSystemArchivalStorage,
};
use std::sync::Arc;
use tempfile::tempdir;

#[test]
fn test_create_retention_policy() {
    let temp_dir = tempdir().unwrap();
    let storage = Arc::new(FileSystemArchivalStorage::new(temp_dir.path().to_path_buf()));
    let service = ArchivalService::new(storage);

    let policy = RetentionPolicy::new(
        "Test Policy".to_string(),
        "wastes".to_string(),
        365,
        90,
    );

    let policy_id = service.create_policy(policy.clone()).unwrap();

    let retrieved = service.get_policy(&policy_id).unwrap();
    assert_eq!(retrieved.name, "Test Policy");
    assert_eq!(retrieved.data_type, "wastes");
    assert_eq!(retrieved.retention_days, 365);
}

#[test]
fn test_list_policies() {
    let temp_dir = tempdir().unwrap();
    let storage = Arc::new(FileSystemArchivalStorage::new(temp_dir.path().to_path_buf()));
    let service = ArchivalService::new(storage);

    let policy1 = RetentionPolicy::new("Policy 1".to_string(), "wastes".to_string(), 365, 90);
    let policy2 = RetentionPolicy::new("Policy 2".to_string(), "participants".to_string(), 730, 180);

    service.create_policy(policy1).unwrap();
    service.create_policy(policy2).unwrap();

    let policies = service.list_policies().unwrap();
    assert_eq!(policies.len(), 2);
}

#[test]
fn test_update_policy() {
    let temp_dir = tempdir().unwrap();
    let storage = Arc::new(FileSystemArchivalStorage::new(temp_dir.path().to_path_buf()));
    let service = ArchivalService::new(storage);

    let mut policy = RetentionPolicy::new("Test".to_string(), "wastes".to_string(), 365, 90);
    let policy_id = service.create_policy(policy.clone()).unwrap();

    policy.retention_days = 730;
    service.update_policy(&policy_id, policy).unwrap();

    let updated = service.get_policy(&policy_id).unwrap();
    assert_eq!(updated.retention_days, 730);
}

#[test]
fn test_delete_policy() {
    let temp_dir = tempdir().unwrap();
    let storage = Arc::new(FileSystemArchivalStorage::new(temp_dir.path().to_path_buf()));
    let service = ArchivalService::new(storage);

    let policy = RetentionPolicy::new("Test".to_string(), "wastes".to_string(), 365, 90);
    let policy_id = service.create_policy(policy).unwrap();

    service.delete_policy(&policy_id).unwrap();

    let result = service.get_policy(&policy_id);
    assert!(result.is_err());
}

#[tokio::test]
async fn test_archive_and_restore_data() {
    let temp_dir = tempdir().unwrap();
    let storage = Arc::new(FileSystemArchivalStorage::new(temp_dir.path().to_path_buf()));
    let service = ArchivalService::new(storage);

    // Create policy
    let policy = RetentionPolicy::new("Test".to_string(), "wastes".to_string(), 365, 90);
    let policy_id = service.create_policy(policy).unwrap();

    // Archive data
    let test_data = b"Hello, World!".to_vec();
    let archive_id = service.archive_data(
        "wastes".to_string(),
        "waste-123".to_string(),
        test_data.clone(),
        policy_id,
    ).await.unwrap();

    // Restore data
    let restored_data = service.restore_data(&archive_id).await.unwrap();
    assert_eq!(restored_data, test_data);
}

#[test]
fn test_archive_query() {
    let temp_dir = tempdir().unwrap();
    let storage = Arc::new(FileSystemArchivalStorage::new(temp_dir.path().to_path_buf()));
    let service = ArchivalService::new(storage);

    let query = ArchiveQuery {
        data_type: Some("wastes".to_string()),
        status: Some(ArchiveStatus::Completed),
        from_date: None,
        to_date: None,
        storage_tier: Some(StorageTier::Cold),
        limit: 100,
        offset: 0,
    };

    let results = service.query_archives(query).unwrap();
    assert!(results.is_empty()); // No archives yet
}

#[test]
fn test_get_statistics() {
    let temp_dir = tempdir().unwrap();
    let storage = Arc::new(FileSystemArchivalStorage::new(temp_dir.path().to_path_buf()));
    let service = ArchivalService::new(storage);

    let stats = service.get_statistics().unwrap();
    assert_eq!(stats.total_archives, 0);
    assert_eq!(stats.total_size, 0);
}

#[test]
fn test_storage_tiers() {
    let temp_dir = tempdir().unwrap();
    let storage = Arc::new(FileSystemArchivalStorage::new(temp_dir.path().to_path_buf()));
    let service = ArchivalService::new(storage);

    let policy_hot = RetentionPolicy {
        id: uuid::Uuid::new_v4().to_string(),
        name: "Hot Storage".to_string(),
        description: String::new(),
        data_type: "recent".to_string(),
        retention_days: 30,
        archive_after_days: 7,
        delete_after_days: None,
        storage_tier: StorageTier::Hot,
        enabled: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let policy_cold = RetentionPolicy {
        id: uuid::Uuid::new_v4().to_string(),
        name: "Cold Storage".to_string(),
        description: String::new(),
        data_type: "old".to_string(),
        retention_days: 3650,
        archive_after_days: 365,
        delete_after_days: Some(7300),
        storage_tier: StorageTier::Glacier,
        enabled: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let hot_id = service.create_policy(policy_hot).unwrap();
    let cold_id = service.create_policy(policy_cold).unwrap();

    let hot_policy = service.get_policy(&hot_id).unwrap();
    let cold_policy = service.get_policy(&cold_id).unwrap();

    assert!(matches!(hot_policy.storage_tier, StorageTier::Hot));
    assert!(matches!(cold_policy.storage_tier, StorageTier::Glacier));
}
