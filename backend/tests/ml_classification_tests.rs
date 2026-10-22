use scavenger_backend::services::ml_classification::*;
use std::sync::Arc;

#[tokio::test]
async fn test_waste_category_as_str() {
    assert_eq!(WasteCategory::Plastic.as_str(), "plastic");
    assert_eq!(WasteCategory::Paper.as_str(), "paper");
    assert_eq!(WasteCategory::Metal.as_str(), "metal");
    assert_eq!(WasteCategory::Glass.as_str(), "glass");
    assert_eq!(WasteCategory::Organic.as_str(), "organic");
    assert_eq!(WasteCategory::Electronic.as_str(), "electronic");
    assert_eq!(WasteCategory::Hazardous.as_str(), "hazardous");
    assert_eq!(WasteCategory::Other.as_str(), "other");
}

#[test]
fn test_classification_service_creation() {
    let service = ClassificationService::new();
    assert_eq!(service.list_versions().len(), 0);
    assert!(service.active_version().is_none());
}

#[test]
fn test_register_version() {
    let service = ClassificationService::new();
    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "waste-classifier".to_string(),
        version: "1.0.0".to_string(),
        description: "First version".to_string(),
        is_active: false,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    struct DummyEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for DummyEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![ClassificationPrediction {
                category: WasteCategory::Plastic,
                confidence: 0.95,
            }])
        }
    }

    let result = service.register_version(version.clone(), Arc::new(DummyEngine));
    assert!(result.is_ok());

    let versions = service.list_versions();
    assert_eq!(versions.len(), 1);
    assert_eq!(versions[0].version_id, "v1");
}

#[test]
fn test_register_duplicate_version() {
    let service = ClassificationService::new();

    struct DummyEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for DummyEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![])
        }
    }

    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "waste-classifier".to_string(),
        version: "1.0.0".to_string(),
        description: "First version".to_string(),
        is_active: false,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    service.register_version(version.clone(), Arc::new(DummyEngine)).unwrap();

    let result = service.register_version(version, Arc::new(DummyEngine));
    assert!(result.is_err());
}

#[test]
fn test_promote_version() {
    let service = ClassificationService::new();

    struct DummyEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for DummyEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![])
        }
    }

    let v1 = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    let v2 = ModelVersion {
        version_id: "v2".to_string(),
        model_name: "classifier".to_string(),
        version: "2.0".to_string(),
        description: "v2".to_string(),
        is_active: false,
        created_at: chrono::Utc::now(),
        accuracy: 0.92,
    };

    service.register_version(v1, Arc::new(DummyEngine)).unwrap();
    service.register_version(v2, Arc::new(DummyEngine)).unwrap();

    // Promote v2
    service.promote_version("v2").unwrap();

    let versions = service.list_versions();
    assert!(versions.iter().find(|v| v.version_id == "v2").unwrap().is_active);
    assert!(!versions.iter().find(|v| v.version_id == "v1").unwrap().is_active);
}

#[test]
fn test_promote_nonexistent_version() {
    let service = ClassificationService::new();
    let result = service.promote_version("nonexistent");
    assert!(result.is_err());
}

#[test]
fn test_active_version_initially_none() {
    let service = ClassificationService::new();
    assert!(service.active_version().is_none());
}

#[test]
fn test_active_version_after_register() {
    let service = ClassificationService::new();

    struct DummyEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for DummyEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![])
        }
    }

    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    service.register_version(version, Arc::new(DummyEngine)).unwrap();
    let active = service.active_version();
    assert!(active.is_some());
    assert_eq!(active.unwrap().version_id, "v1");
}

#[tokio::test]
async fn test_classify_with_empty_image() {
    let service = ClassificationService::new();

    struct DummyEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for DummyEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![])
        }
    }

    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    service.register_version(version, Arc::new(DummyEngine)).unwrap();

    let request = ClassificationRequest {
        image: "".to_string(),
        model_version_id: None,
    };

    let result = service.classify(request).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_classify_with_no_active_version() {
    let service = ClassificationService::new();

    let request = ClassificationRequest {
        image: "image_data".to_string(),
        model_version_id: None,
    };

    let result = service.classify(request).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_classify_success() {
    let service = ClassificationService::new();

    struct TestEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for TestEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![
                ClassificationPrediction {
                    category: WasteCategory::Plastic,
                    confidence: 0.95,
                },
                ClassificationPrediction {
                    category: WasteCategory::Paper,
                    confidence: 0.04,
                },
                ClassificationPrediction {
                    category: WasteCategory::Other,
                    confidence: 0.01,
                },
            ])
        }
    }

    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.95,
    };

    service.register_version(version, Arc::new(TestEngine)).unwrap();

    let request = ClassificationRequest {
        image: "test_image_data".to_string(),
        model_version_id: None,
    };

    let result = service.classify(request).await.expect("Classification should succeed");
    assert_eq!(result.top_prediction.category, WasteCategory::Plastic);
    assert_eq!(result.top_prediction.confidence, 0.95);
    assert_eq!(result.all_predictions.len(), 3);
    assert!(result.latency_ms >= 0);
}

#[tokio::test]
async fn test_classify_with_specific_version() {
    let service = ClassificationService::new();

    struct TestEngine {
        category: WasteCategory,
    }

    #[async_trait::async_trait]
    impl InferenceEngine for TestEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![ClassificationPrediction {
                category: self.category.clone(),
                confidence: 0.9,
            }])
        }
    }

    let v1 = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    let v2 = ModelVersion {
        version_id: "v2".to_string(),
        model_name: "classifier".to_string(),
        version: "2.0".to_string(),
        description: "v2".to_string(),
        is_active: false,
        created_at: chrono::Utc::now(),
        accuracy: 0.92,
    };

    service.register_version(v1, Arc::new(TestEngine { category: WasteCategory::Plastic })).unwrap();
    service.register_version(v2, Arc::new(TestEngine { category: WasteCategory::Metal })).unwrap();

    let request = ClassificationRequest {
        image: "test_data".to_string(),
        model_version_id: Some("v2".to_string()),
    };

    let result = service.classify(request).await.expect("Classification should succeed");
    assert_eq!(result.top_prediction.category, WasteCategory::Metal);
    assert_eq!(result.model_version_id, "v2");
}

#[tokio::test]
async fn test_classify_with_nonexistent_version() {
    let service = ClassificationService::new();

    struct TestEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for TestEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![])
        }
    }

    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    service.register_version(version, Arc::new(TestEngine)).unwrap();

    let request = ClassificationRequest {
        image: "test_data".to_string(),
        model_version_id: Some("nonexistent".to_string()),
    };

    let result = service.classify(request).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_evaluate_empty_samples() {
    let service = ClassificationService::new();

    struct TestEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for TestEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![])
        }
    }

    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    service.register_version(version, Arc::new(TestEngine)).unwrap();

    let result = service.evaluate("v1", vec![]).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_evaluate_success() {
    let service = ClassificationService::new();

    struct TestEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for TestEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![ClassificationPrediction {
                category: WasteCategory::Plastic,
                confidence: 0.9,
            }])
        }
    }

    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    service.register_version(version, Arc::new(TestEngine)).unwrap();

    let samples = vec![
        EvaluationSample {
            image: "img1".to_string(),
            ground_truth: WasteCategory::Plastic,
        },
        EvaluationSample {
            image: "img2".to_string(),
            ground_truth: WasteCategory::Plastic,
        },
        EvaluationSample {
            image: "img3".to_string(),
            ground_truth: WasteCategory::Plastic,
        },
    ];

    let result = service.evaluate("v1", samples).await.expect("Evaluation should succeed");
    assert_eq!(result.model_version_id, "v1");
    assert_eq!(result.total_samples, 3);
    assert_eq!(result.correct, 3);
    assert!((result.accuracy - 1.0).abs() < 0.001);
}

#[tokio::test]
async fn test_evaluate_with_nonexistent_version() {
    let service = ClassificationService::new();

    let samples = vec![EvaluationSample {
        image: "img1".to_string(),
        ground_truth: WasteCategory::Plastic,
    }];

    let result = service.evaluate("nonexistent", samples).await;
    assert!(result.is_err());
}

#[test]
fn test_monitoring_summary_empty() {
    let service = ClassificationService::new();
    let summary = service.monitoring_summary();
    assert_eq!(summary.total_requests, 0);
    assert_eq!(summary.avg_latency_ms, 0.0);
}

#[tokio::test]
async fn test_monitoring_summary_with_requests() {
    let service = ClassificationService::new();

    struct TestEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for TestEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![
                ClassificationPrediction {
                    category: WasteCategory::Plastic,
                    confidence: 0.95,
                },
                ClassificationPrediction {
                    category: WasteCategory::Metal,
                    confidence: 0.04,
                },
            ])
        }
    }

    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    service.register_version(version, Arc::new(TestEngine)).unwrap();

    // Make several classification requests
    for i in 0..3 {
        let request = ClassificationRequest {
            image: format!("image_{}", i),
            model_version_id: None,
        };
        let _ = service.classify(request).await;
    }

    let summary = service.monitoring_summary();
    assert_eq!(summary.total_requests, 3);
    assert!(summary.avg_latency_ms >= 0.0);
    assert!(summary.avg_confidence > 0.0);
}

#[test]
fn test_get_inference_logs() {
    let service = ClassificationService::new();
    assert_eq!(service.get_inference_logs().len(), 0);
}

#[tokio::test]
async fn test_get_inference_logs_after_classification() {
    let service = ClassificationService::new();

    struct TestEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for TestEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![ClassificationPrediction {
                category: WasteCategory::Plastic,
                confidence: 0.95,
            }])
        }
    }

    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    service.register_version(version, Arc::new(TestEngine)).unwrap();

    let request = ClassificationRequest {
        image: "test_image".to_string(),
        model_version_id: None,
    };

    service.classify(request).await.unwrap();

    let logs = service.get_inference_logs();
    assert_eq!(logs.len(), 1);
    assert_eq!(logs[0].top_category, WasteCategory::Plastic);
    assert_eq!(logs[0].top_confidence, 0.95);
}

#[test]
fn test_classification_service_default() {
    let service = ClassificationService::default();
    assert_eq!(service.list_versions().len(), 0);
}

#[tokio::test]
async fn test_predictions_sorted_by_confidence() {
    let service = ClassificationService::new();

    struct TestEngine;
    #[async_trait::async_trait]
    impl InferenceEngine for TestEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![
                ClassificationPrediction {
                    category: WasteCategory::Other,
                    confidence: 0.1,
                },
                ClassificationPrediction {
                    category: WasteCategory::Plastic,
                    confidence: 0.95,
                },
                ClassificationPrediction {
                    category: WasteCategory::Paper,
                    confidence: 0.5,
                },
            ])
        }
    }

    let version = ModelVersion {
        version_id: "v1".to_string(),
        model_name: "classifier".to_string(),
        version: "1.0".to_string(),
        description: "v1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        accuracy: 0.85,
    };

    service.register_version(version, Arc::new(TestEngine)).unwrap();

    let request = ClassificationRequest {
        image: "test".to_string(),
        model_version_id: None,
    };

    let result = service.classify(request).await.unwrap();
    assert_eq!(result.top_prediction.confidence, 0.95);

    // Verify all predictions are sorted descending by confidence
    for i in 1..result.all_predictions.len() {
        assert!(result.all_predictions[i-1].confidence >= result.all_predictions[i].confidence);
    }
}
