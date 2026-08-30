use chrono::{DateTime, Utc};
/// #803 - ML Waste Classification Service
/// Model serving endpoint, versioning, monitoring, and evaluation for waste image classification.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use thiserror::Error;
use uuid::Uuid;

// ── Errors ────────────────────────────────────────────────────────────────────

#[derive(Debug, Error, Clone)]
pub enum ClassificationError {
    #[error("Model not found: {0}")]
    ModelNotFound(String),
    #[error("Inference error: {0}")]
    InferenceError(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Version conflict: {0}")]
    VersionConflict(String),
}

// ── Waste types that the classifier can predict ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum WasteCategory {
    Plastic,
    Paper,
    Metal,
    Glass,
    Organic,
    Electronic,
    Hazardous,
    Other,
}

impl WasteCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Plastic => "plastic",
            Self::Paper => "paper",
            Self::Metal => "metal",
            Self::Glass => "glass",
            Self::Organic => "organic",
            Self::Electronic => "electronic",
            Self::Hazardous => "hazardous",
            Self::Other => "other",
        }
    }
}

// ── Model version ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelVersion {
    pub version_id: String,
    pub model_name: String,
    pub version: String,
    pub description: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    /// Accuracy on evaluation dataset (0.0 – 1.0)
    pub accuracy: f64,
}

// ── Inference ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassificationRequest {
    /// Base64-encoded image bytes or a URL
    pub image: String,
    /// Optional model version ID; defaults to the active version
    pub model_version_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassificationPrediction {
    pub category: WasteCategory,
    /// Confidence in [0, 1]
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassificationResult {
    pub request_id: String,
    pub model_version_id: String,
    pub top_prediction: ClassificationPrediction,
    pub all_predictions: Vec<ClassificationPrediction>,
    pub latency_ms: u64,
    pub classified_at: DateTime<Utc>,
}

// ── Evaluation ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationSample {
    pub image: String,
    pub ground_truth: WasteCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationReport {
    pub model_version_id: String,
    pub total_samples: usize,
    pub correct: usize,
    pub accuracy: f64,
    /// Per-class metrics
    pub per_class: HashMap<String, ClassMetrics>,
    pub evaluated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassMetrics {
    pub precision: f64,
    pub recall: f64,
    pub f1: f64,
    pub support: usize,
}

// ── Monitoring record ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceLog {
    pub request_id: String,
    pub model_version_id: String,
    pub input_size_bytes: usize,
    pub latency_ms: u64,
    pub top_category: WasteCategory,
    pub top_confidence: f64,
    pub logged_at: DateTime<Utc>,
}

// ── Inference engine trait ────────────────────────────────────────────────────

/// Abstraction over the actual ML runtime (ONNX, TorchScript, etc.).
#[async_trait::async_trait]
pub trait InferenceEngine: Send + Sync {
    async fn predict(&self, image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError>;
}

/// Mock inference engine used in tests.
pub struct MockInferenceEngine;

#[async_trait::async_trait]
impl InferenceEngine for MockInferenceEngine {
    async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
        Ok(vec![
            ClassificationPrediction {
                category: WasteCategory::Plastic,
                confidence: 0.82,
            },
            ClassificationPrediction {
                category: WasteCategory::Paper,
                confidence: 0.10,
            },
            ClassificationPrediction {
                category: WasteCategory::Metal,
                confidence: 0.05,
            },
            ClassificationPrediction {
                category: WasteCategory::Other,
                confidence: 0.03,
            },
        ])
    }
}

// ── Classification service ────────────────────────────────────────────────────

pub struct ClassificationService {
    engines: Mutex<HashMap<String, Arc<dyn InferenceEngine>>>,
    versions: Mutex<Vec<ModelVersion>>,
    logs: Mutex<Vec<InferenceLog>>,
}

impl ClassificationService {
    pub fn new() -> Self {
        Self {
            engines: Mutex::new(HashMap::new()),
            versions: Mutex::new(Vec::new()),
            logs: Mutex::new(Vec::new()),
        }
    }

    // ── Model version management ───────────────────────────────────────────

    /// Register a new model version with its engine.
    pub fn register_version(
        &self,
        version: ModelVersion,
        engine: Arc<dyn InferenceEngine>,
    ) -> Result<(), ClassificationError> {
        {
            let versions = self.versions.lock().unwrap();
            if versions.iter().any(|v| v.version_id == version.version_id) {
                return Err(ClassificationError::VersionConflict(version.version_id.clone()));
            }
        }
        self.engines.lock().unwrap().insert(version.version_id.clone(), engine);
        self.versions.lock().unwrap().push(version);
        Ok(())
    }

    /// Promote a version to active; demote all others.
    pub fn promote_version(&self, version_id: &str) -> Result<(), ClassificationError> {
        let mut versions = self.versions.lock().unwrap();
        let found = versions.iter().any(|v| v.version_id == version_id);
        if !found {
            return Err(ClassificationError::ModelNotFound(version_id.to_string()));
        }
        for v in versions.iter_mut() {
            v.is_active = v.version_id == version_id;
        }
        Ok(())
    }

    pub fn active_version(&self) -> Option<ModelVersion> {
        self.versions.lock().unwrap().iter().find(|v| v.is_active).cloned()
    }

    pub fn list_versions(&self) -> Vec<ModelVersion> {
        self.versions.lock().unwrap().clone()
    }

    // ── Inference ──────────────────────────────────────────────────────────

    pub async fn classify(&self, req: ClassificationRequest) -> Result<ClassificationResult, ClassificationError> {
        if req.image.is_empty() {
            return Err(ClassificationError::InvalidInput("Empty image data".to_string()));
        }

        // Resolve version
        let version_id = if let Some(vid) = req.model_version_id {
            vid
        } else {
            self.active_version()
                .ok_or_else(|| ClassificationError::ModelNotFound("no active version".to_string()))?
                .version_id
        };

        let engine = self
            .engines
            .lock()
            .unwrap()
            .get(&version_id)
            .cloned()
            .ok_or_else(|| ClassificationError::ModelNotFound(version_id.clone()))?;

        let image_bytes = req.image.as_bytes();
        let start = std::time::Instant::now();
        let mut predictions = engine.predict(image_bytes).await?;
        let latency_ms = start.elapsed().as_millis() as u64;

        // Sort by confidence descending
        predictions.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());

        let top = predictions
            .first()
            .cloned()
            .ok_or_else(|| ClassificationError::InferenceError("No predictions".to_string()))?;

        let request_id = Uuid::new_v4().to_string();

        // Log for monitoring
        self.logs.lock().unwrap().push(InferenceLog {
            request_id: request_id.clone(),
            model_version_id: version_id.clone(),
            input_size_bytes: image_bytes.len(),
            latency_ms,
            top_category: top.category.clone(),
            top_confidence: top.confidence,
            logged_at: Utc::now(),
        });

        Ok(ClassificationResult {
            request_id,
            model_version_id: version_id,
            top_prediction: top,
            all_predictions: predictions,
            latency_ms,
            classified_at: Utc::now(),
        })
    }

    // ── Evaluation ─────────────────────────────────────────────────────────

    pub async fn evaluate(
        &self,
        version_id: &str,
        samples: Vec<EvaluationSample>,
    ) -> Result<EvaluationReport, ClassificationError> {
        if samples.is_empty() {
            return Err(ClassificationError::InvalidInput("No evaluation samples".to_string()));
        }

        let engine = self
            .engines
            .lock()
            .unwrap()
            .get(version_id)
            .cloned()
            .ok_or_else(|| ClassificationError::ModelNotFound(version_id.to_string()))?;

        let mut correct = 0usize;
        let mut per_class: HashMap<String, (usize, usize, usize)> = HashMap::new();
        // (true_positives, false_positives, false_negatives)

        for sample in &samples {
            let mut preds = engine.predict(sample.image.as_bytes()).await?;
            preds.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
            let predicted = preds
                .first()
                .map(|p| p.category.clone())
                .unwrap_or(WasteCategory::Other);

            let gt = sample.ground_truth.as_str().to_string();
            let pred_str = predicted.as_str().to_string();

            if predicted == sample.ground_truth {
                correct += 1;
                let e = per_class.entry(gt).or_default();
                e.0 += 1; // TP
            } else {
                let gt_e = per_class.entry(gt.clone()).or_default();
                gt_e.2 += 1; // FN
                let pred_e = per_class.entry(pred_str).or_default();
                pred_e.1 += 1; // FP
            }
        }

        let accuracy = correct as f64 / samples.len() as f64;

        let per_class_metrics = per_class
            .into_iter()
            .map(|(cls, (tp, fp, fn_))| {
                let precision = if tp + fp == 0 {
                    0.0
                } else {
                    tp as f64 / (tp + fp) as f64
                };
                let recall = if tp + fn_ == 0 {
                    0.0
                } else {
                    tp as f64 / (tp + fn_) as f64
                };
                let f1 = if precision + recall == 0.0 {
                    0.0
                } else {
                    2.0 * precision * recall / (precision + recall)
                };
                (
                    cls,
                    ClassMetrics {
                        precision,
                        recall,
                        f1,
                        support: tp + fn_,
                    },
                )
            })
            .collect();

        Ok(EvaluationReport {
            model_version_id: version_id.to_string(),
            total_samples: samples.len(),
            correct,
            accuracy,
            per_class: per_class_metrics,
            evaluated_at: Utc::now(),
        })
    }

    // ── Monitoring ─────────────────────────────────────────────────────────

    pub fn monitoring_summary(&self) -> MonitoringSummary {
        let logs = self.logs.lock().unwrap();
        if logs.is_empty() {
            return MonitoringSummary::default();
        }
        let total = logs.len();
        let avg_latency = logs.iter().map(|l| l.latency_ms).sum::<u64>() as f64 / total as f64;
        let avg_confidence = logs.iter().map(|l| l.top_confidence).sum::<f64>() / total as f64;
        let low_confidence = logs.iter().filter(|l| l.top_confidence < 0.6).count();

        let mut by_category: HashMap<String, usize> = HashMap::new();
        for l in logs.iter() {
            *by_category.entry(l.top_category.as_str().to_string()).or_default() += 1;
        }

        MonitoringSummary {
            total_requests: total,
            avg_latency_ms: avg_latency,
            avg_confidence,
            low_confidence_count: low_confidence,
            predictions_by_category: by_category,
        }
    }

    pub fn get_inference_logs(&self) -> Vec<InferenceLog> {
        self.logs.lock().unwrap().clone()
    }
}

impl Default for ClassificationService {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MonitoringSummary {
    pub total_requests: usize,
    pub avg_latency_ms: f64,
    pub avg_confidence: f64,
    pub low_confidence_count: usize,
    pub predictions_by_category: HashMap<String, usize>,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn make_version(id: &str, is_active: bool) -> ModelVersion {
        ModelVersion {
            version_id: id.to_string(),
            model_name: "waste-classifier".to_string(),
            version: id.to_string(),
            description: "Test version".to_string(),
            is_active,
            created_at: Utc::now(),
            accuracy: 0.85,
        }
    }

    fn make_service() -> ClassificationService {
        let svc = ClassificationService::new();
        svc.register_version(make_version("v1", true), Arc::new(MockInferenceEngine))
            .unwrap();
        svc
    }

    // ── Low-confidence inference engine (confidence always below threshold) ──

    struct LowConfidenceEngine;

    #[async_trait::async_trait]
    impl InferenceEngine for LowConfidenceEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![
                ClassificationPrediction {
                    category: WasteCategory::Other,
                    confidence: 0.35,
                },
                ClassificationPrediction {
                    category: WasteCategory::Plastic,
                    confidence: 0.25,
                },
            ])
        }
    }

    // ── Engine that returns a single prediction ────────────────────────────

    struct SinglePredictionEngine {
        category: WasteCategory,
        confidence: f64,
    }

    #[async_trait::async_trait]
    impl InferenceEngine for SinglePredictionEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![ClassificationPrediction {
                category: self.category.clone(),
                confidence: self.confidence,
            }])
        }
    }

    // ── Engine that always errors ──────────────────────────────────────────

    struct ErrorEngine;

    #[async_trait::async_trait]
    impl InferenceEngine for ErrorEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Err(ClassificationError::InferenceError("mock engine failure".to_string()))
        }
    }

    // ── Engine that returns no predictions ────────────────────────────────

    struct EmptyPredictionsEngine;

    #[async_trait::async_trait]
    impl InferenceEngine for EmptyPredictionsEngine {
        async fn predict(&self, _image_data: &[u8]) -> Result<Vec<ClassificationPrediction>, ClassificationError> {
            Ok(vec![])
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Original tests (preserved)
    // ─────────────────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_classify_with_active_version() {
        let svc = make_service();
        let result = svc
            .classify(ClassificationRequest {
                image: "base64imagedata==".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap();
        assert_eq!(result.top_prediction.category, WasteCategory::Plastic);
        assert!(result.top_prediction.confidence > 0.8);
    }

    #[tokio::test]
    async fn test_classify_explicit_version() {
        let svc = make_service();
        let result = svc
            .classify(ClassificationRequest {
                image: "imagedata".to_string(),
                model_version_id: Some("v1".to_string()),
            })
            .await
            .unwrap();
        assert_eq!(result.model_version_id, "v1");
    }

    #[tokio::test]
    async fn test_classify_invalid_input() {
        let svc = make_service();
        let err = svc
            .classify(ClassificationRequest {
                image: "".to_string(),
                model_version_id: None,
            })
            .await;
        assert!(matches!(err, Err(ClassificationError::InvalidInput(_))));
    }

    #[tokio::test]
    async fn test_version_not_found() {
        let svc = make_service();
        let err = svc
            .classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: Some("nonexistent".to_string()),
            })
            .await;
        assert!(matches!(err, Err(ClassificationError::ModelNotFound(_))));
    }

    #[test]
    fn test_version_promotion() {
        let svc = ClassificationService::new();
        for (id, active) in [("v1", true), ("v2", false)] {
            svc.register_version(make_version(id, active), Arc::new(MockInferenceEngine))
                .unwrap();
        }
        svc.promote_version("v2").unwrap();
        assert_eq!(svc.active_version().unwrap().version_id, "v2");
    }

    #[test]
    fn test_duplicate_version_error() {
        let svc = make_service();
        let v = ModelVersion {
            version_id: "v1".to_string(),
            model_name: "m".to_string(),
            version: "1.0.0".to_string(),
            description: "".to_string(),
            is_active: false,
            created_at: Utc::now(),
            accuracy: 0.9,
        };
        assert!(matches!(
            svc.register_version(v, Arc::new(MockInferenceEngine)),
            Err(ClassificationError::VersionConflict(_))
        ));
    }

    #[tokio::test]
    async fn test_evaluate() {
        let svc = make_service();
        let samples = vec![
            EvaluationSample {
                image: "img1".to_string(),
                ground_truth: WasteCategory::Plastic,
            },
            EvaluationSample {
                image: "img2".to_string(),
                ground_truth: WasteCategory::Paper,
            },
        ];
        let report = svc.evaluate("v1", samples).await.unwrap();
        assert_eq!(report.total_samples, 2);
        assert!(report.accuracy >= 0.0 && report.accuracy <= 1.0);
    }

    #[tokio::test]
    async fn test_monitoring_summary() {
        let svc = make_service();
        for _ in 0..3 {
            svc.classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap();
        }
        let summary = svc.monitoring_summary();
        assert_eq!(summary.total_requests, 3);
        assert!(summary.avg_confidence > 0.0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Issue #1127 — New tests
    // ─────────────────────────────────────────────────────────────────────────

    // ── Known input/output pairs (fixtures) ──────────────────────────────────

    #[tokio::test]
    async fn test_classify_returns_expected_category_and_confidence() {
        // MockInferenceEngine always returns Plastic with 0.82 confidence.
        let svc = make_service();
        let result = svc
            .classify(ClassificationRequest {
                image: "plastic-bottle-image".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap();

        assert_eq!(result.top_prediction.category, WasteCategory::Plastic);
        // Confidence should be within the expected fixture range
        assert!((result.top_prediction.confidence - 0.82).abs() < 1e-9);
    }

    #[tokio::test]
    async fn test_classify_all_predictions_sorted_by_confidence_descending() {
        let svc = make_service();
        let result = svc
            .classify(ClassificationRequest {
                image: "image_data".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap();

        let confs: Vec<f64> = result.all_predictions.iter().map(|p| p.confidence).collect();
        for window in confs.windows(2) {
            assert!(
                window[0] >= window[1],
                "predictions not sorted: {} >= {} is false",
                window[0],
                window[1]
            );
        }
    }

    #[tokio::test]
    async fn test_classify_result_contains_request_id() {
        let svc = make_service();
        let result = svc
            .classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap();
        // Request ID must be a non-empty UUID-like string
        assert!(!result.request_id.is_empty());
        // Must be a valid UUID format (36 chars, dashes at pos 8, 13, 18, 23)
        assert_eq!(result.request_id.len(), 36);
    }

    #[tokio::test]
    async fn test_classify_latency_recorded() {
        let svc = make_service();
        let result = svc
            .classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap();
        // Latency must be non-negative (u64 so already ≥ 0)
        assert!(result.latency_ms < 60_000, "latency suspiciously high");
    }

    // ── Low-confidence fallback path ─────────────────────────────────────────

    /// Coordinate system assumption: a top prediction with confidence < 0.6 is
    /// considered "low confidence" and must be surfaced via the monitoring
    /// summary's `low_confidence_count` field so that operators can flag items
    /// for manual review.
    #[tokio::test]
    async fn test_low_confidence_predictions_counted_in_monitoring() {
        let svc = ClassificationService::new();
        svc.register_version(make_version("low-conf", true), Arc::new(LowConfidenceEngine))
            .unwrap();

        // Run several low-confidence classifications
        for _ in 0..5 {
            svc.classify(ClassificationRequest {
                image: "unclear_image".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap();
        }

        let summary = svc.monitoring_summary();
        assert_eq!(summary.total_requests, 5);
        // All predictions are below the 0.6 threshold → all must be counted
        assert_eq!(summary.low_confidence_count, 5);
    }

    #[tokio::test]
    async fn test_high_confidence_not_counted_as_low_confidence() {
        let svc = make_service(); // uses MockInferenceEngine → 0.82 confidence
        svc.classify(ClassificationRequest {
            image: "data".to_string(),
            model_version_id: None,
        })
        .await
        .unwrap();

        let summary = svc.monitoring_summary();
        assert_eq!(summary.low_confidence_count, 0);
    }

    #[tokio::test]
    async fn test_mixed_confidence_count() {
        let svc = ClassificationService::new();
        // Register two versions: one high-conf, one low-conf
        svc.register_version(make_version("high", true), Arc::new(MockInferenceEngine))
            .unwrap();
        svc.register_version(make_version("low", false), Arc::new(LowConfidenceEngine))
            .unwrap();

        // 2 high-confidence + 3 low-confidence
        for _ in 0..2 {
            svc.classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: Some("high".to_string()),
            })
            .await
            .unwrap();
        }
        for _ in 0..3 {
            svc.classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: Some("low".to_string()),
            })
            .await
            .unwrap();
        }

        let summary = svc.monitoring_summary();
        assert_eq!(summary.total_requests, 5);
        assert_eq!(summary.low_confidence_count, 3);
    }

    // ── Malformed / empty input handling ────────────────────────────────────

    #[tokio::test]
    async fn test_classify_whitespace_only_image_is_not_empty_but_valid() {
        // A whitespace-only string is non-empty; the engine receives it as bytes.
        // Validates that the service does NOT reject whitespace-only strings as
        // "empty" — only truly empty strings fail the guard.
        let svc = make_service();
        let result = svc
            .classify(ClassificationRequest {
                image: "   ".to_string(),
                model_version_id: None,
            })
            .await;
        // Should succeed (engine gets " " bytes), not be an InvalidInput error
        assert!(result.is_ok(), "whitespace-only image should not be rejected");
    }

    #[tokio::test]
    async fn test_classify_empty_image_returns_invalid_input_error() {
        let svc = make_service();
        let err = svc
            .classify(ClassificationRequest {
                image: String::new(),
                model_version_id: None,
            })
            .await
            .unwrap_err();
        match err {
            ClassificationError::InvalidInput(msg) => {
                assert!(msg.contains("Empty"), "error message should mention empty input");
            }
            other => panic!("expected InvalidInput, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_classify_nonexistent_model_version_returns_model_not_found() {
        let svc = make_service();
        let err = svc
            .classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: Some("does-not-exist-v99".to_string()),
            })
            .await
            .unwrap_err();
        assert!(
            matches!(err, ClassificationError::ModelNotFound(_)),
            "got {:?}",
            err
        );
    }

    #[tokio::test]
    async fn test_classify_without_active_version_and_no_version_id_returns_error() {
        // Service with no versions at all
        let svc = ClassificationService::new();
        let err = svc
            .classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap_err();
        assert!(
            matches!(err, ClassificationError::ModelNotFound(_)),
            "got {:?}",
            err
        );
    }

    #[tokio::test]
    async fn test_classify_engine_inference_error_propagates() {
        let svc = ClassificationService::new();
        svc.register_version(make_version("broken", true), Arc::new(ErrorEngine))
            .unwrap();

        let err = svc
            .classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap_err();
        assert!(
            matches!(err, ClassificationError::InferenceError(_)),
            "got {:?}",
            err
        );
    }

    #[tokio::test]
    async fn test_classify_engine_returns_no_predictions_is_inference_error() {
        let svc = ClassificationService::new();
        svc.register_version(make_version("empty-preds", true), Arc::new(EmptyPredictionsEngine))
            .unwrap();

        let err = svc
            .classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap_err();
        assert!(
            matches!(err, ClassificationError::InferenceError(_)),
            "got {:?}",
            err
        );
    }

    // ── Model version management edge cases ──────────────────────────────────

    #[test]
    fn test_promote_nonexistent_version_returns_model_not_found() {
        let svc = make_service();
        let err = svc.promote_version("ghost-version").unwrap_err();
        assert!(matches!(err, ClassificationError::ModelNotFound(_)));
    }

    #[test]
    fn test_promote_version_deactivates_all_others() {
        let svc = ClassificationService::new();
        for id in ["v1", "v2", "v3"] {
            svc.register_version(make_version(id, id == "v1"), Arc::new(MockInferenceEngine))
                .unwrap();
        }
        svc.promote_version("v3").unwrap();

        let versions = svc.list_versions();
        let active: Vec<_> = versions.iter().filter(|v| v.is_active).collect();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].version_id, "v3");
    }

    #[test]
    fn test_active_version_none_when_no_active_set() {
        let svc = ClassificationService::new();
        svc.register_version(make_version("v1", false), Arc::new(MockInferenceEngine))
            .unwrap();
        assert!(svc.active_version().is_none());
    }

    #[test]
    fn test_list_versions_returns_all_registered() {
        let svc = ClassificationService::new();
        for id in ["a", "b", "c"] {
            svc.register_version(make_version(id, false), Arc::new(MockInferenceEngine))
                .unwrap();
        }
        assert_eq!(svc.list_versions().len(), 3);
    }

    #[test]
    fn test_default_service_has_no_versions() {
        let svc = ClassificationService::default();
        assert!(svc.list_versions().is_empty());
        assert!(svc.active_version().is_none());
    }

    // ── Monitoring / evaluation edge cases ───────────────────────────────────

    #[test]
    fn test_monitoring_summary_empty_when_no_requests() {
        let svc = make_service();
        let summary = svc.monitoring_summary();
        assert_eq!(summary.total_requests, 0);
        assert_eq!(summary.avg_latency_ms, 0.0);
        assert_eq!(summary.avg_confidence, 0.0);
        assert_eq!(summary.low_confidence_count, 0);
        assert!(summary.predictions_by_category.is_empty());
    }

    #[tokio::test]
    async fn test_monitoring_summary_tracks_category_distribution() {
        let svc = make_service(); // MockInferenceEngine → always Plastic
        for _ in 0..4 {
            svc.classify(ClassificationRequest {
                image: "data".to_string(),
                model_version_id: None,
            })
            .await
            .unwrap();
        }
        let summary = svc.monitoring_summary();
        assert_eq!(
            *summary.predictions_by_category.get("plastic").unwrap_or(&0),
            4
        );
    }

    #[tokio::test]
    async fn test_inference_logs_recorded_per_request() {
        let svc = make_service();
        svc.classify(ClassificationRequest {
            image: "data".to_string(),
            model_version_id: None,
        })
        .await
        .unwrap();
        svc.classify(ClassificationRequest {
            image: "more_data".to_string(),
            model_version_id: None,
        })
        .await
        .unwrap();

        let logs = svc.get_inference_logs();
        assert_eq!(logs.len(), 2);
        // Each log has a unique request_id
        assert_ne!(logs[0].request_id, logs[1].request_id);
    }

    #[tokio::test]
    async fn test_inference_log_records_input_size() {
        let svc = make_service();
        let image = "12345678"; // 8 bytes
        svc.classify(ClassificationRequest {
            image: image.to_string(),
            model_version_id: None,
        })
        .await
        .unwrap();

        let logs = svc.get_inference_logs();
        assert_eq!(logs[0].input_size_bytes, 8);
    }

    #[tokio::test]
    async fn test_evaluate_empty_samples_returns_invalid_input() {
        let svc = make_service();
        let err = svc.evaluate("v1", vec![]).await.unwrap_err();
        assert!(matches!(err, ClassificationError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn test_evaluate_nonexistent_version_returns_model_not_found() {
        let svc = make_service();
        let samples = vec![EvaluationSample {
            image: "img".to_string(),
            ground_truth: WasteCategory::Metal,
        }];
        let err = svc.evaluate("ghost", samples).await.unwrap_err();
        assert!(matches!(err, ClassificationError::ModelNotFound(_)));
    }

    #[tokio::test]
    async fn test_evaluate_perfect_accuracy_when_predictions_match() {
        // Use a Plastic-only engine and provide all-Plastic ground truth
        let svc = ClassificationService::new();
        let engine = SinglePredictionEngine {
            category: WasteCategory::Plastic,
            confidence: 0.99,
        };
        svc.register_version(make_version("perfect", true), Arc::new(engine))
            .unwrap();

        let samples: Vec<EvaluationSample> = (0..5)
            .map(|i| EvaluationSample {
                image: format!("img{i}"),
                ground_truth: WasteCategory::Plastic,
            })
            .collect();

        let report = svc.evaluate("perfect", samples).await.unwrap();
        assert_eq!(report.correct, 5);
        assert!((report.accuracy - 1.0).abs() < 1e-9);
    }

    #[tokio::test]
    async fn test_evaluate_zero_accuracy_when_all_wrong() {
        // Engine predicts Plastic, ground truth is Paper — zero correct
        let svc = ClassificationService::new();
        let engine = SinglePredictionEngine {
            category: WasteCategory::Plastic,
            confidence: 0.99,
        };
        svc.register_version(make_version("wrong", true), Arc::new(engine))
            .unwrap();

        let samples: Vec<EvaluationSample> = (0..4)
            .map(|i| EvaluationSample {
                image: format!("img{i}"),
                ground_truth: WasteCategory::Paper,
            })
            .collect();

        let report = svc.evaluate("wrong", samples).await.unwrap();
        assert_eq!(report.correct, 0);
        assert!((report.accuracy - 0.0).abs() < 1e-9);
    }

    #[tokio::test]
    async fn test_evaluate_per_class_metrics_precision_recall() {
        // All predictions are correct → precision=recall=f1=1.0 for "plastic"
        let svc = ClassificationService::new();
        let engine = SinglePredictionEngine {
            category: WasteCategory::Plastic,
            confidence: 0.9,
        };
        svc.register_version(make_version("v", true), Arc::new(engine))
            .unwrap();

        let samples = vec![
            EvaluationSample {
                image: "a".to_string(),
                ground_truth: WasteCategory::Plastic,
            },
            EvaluationSample {
                image: "b".to_string(),
                ground_truth: WasteCategory::Plastic,
            },
        ];
        let report = svc.evaluate("v", samples).await.unwrap();

        let plastic_metrics = report.per_class.get("plastic").expect("plastic metrics");
        assert!((plastic_metrics.precision - 1.0).abs() < 1e-9);
        assert!((plastic_metrics.recall - 1.0).abs() < 1e-9);
        assert!((plastic_metrics.f1 - 1.0).abs() < 1e-9);
    }

    // ── WasteCategory helpers ────────────────────────────────────────────────

    #[test]
    fn test_waste_category_as_str_all_variants() {
        let cases = [
            (WasteCategory::Plastic, "plastic"),
            (WasteCategory::Paper, "paper"),
            (WasteCategory::Metal, "metal"),
            (WasteCategory::Glass, "glass"),
            (WasteCategory::Organic, "organic"),
            (WasteCategory::Electronic, "electronic"),
            (WasteCategory::Hazardous, "hazardous"),
            (WasteCategory::Other, "other"),
        ];
        for (cat, expected) in cases {
            assert_eq!(cat.as_str(), expected);
        }
    }

    #[test]
    fn test_waste_category_equality() {
        assert_eq!(WasteCategory::Plastic, WasteCategory::Plastic);
        assert_ne!(WasteCategory::Plastic, WasteCategory::Paper);
    }

    // ── Error message content ────────────────────────────────────────────────

    #[test]
    fn test_classification_error_display_messages() {
        let e1 = ClassificationError::ModelNotFound("v99".to_string());
        assert!(e1.to_string().contains("v99"));

        let e2 = ClassificationError::InferenceError("boom".to_string());
        assert!(e2.to_string().contains("boom"));

        let e3 = ClassificationError::InvalidInput("bad".to_string());
        assert!(e3.to_string().contains("bad"));

        let e4 = ClassificationError::VersionConflict("v1".to_string());
        assert!(e4.to_string().contains("v1"));
    }
}
