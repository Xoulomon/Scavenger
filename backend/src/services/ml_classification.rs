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

    fn make_service() -> ClassificationService {
        let svc = ClassificationService::new();
        let v = ModelVersion {
            version_id: "v1".to_string(),
            model_name: "waste-classifier".to_string(),
            version: "1.0.0".to_string(),
            description: "Initial model".to_string(),
            is_active: true,
            created_at: Utc::now(),
            accuracy: 0.85,
        };
        svc.register_version(v, Arc::new(MockInferenceEngine)).unwrap();
        svc
    }

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
            let v = ModelVersion {
                version_id: id.to_string(),
                model_name: "m".to_string(),
                version: id.to_string(),
                description: "".to_string(),
                is_active: active,
                created_at: Utc::now(),
                accuracy: 0.8,
            };
            svc.register_version(v, Arc::new(MockInferenceEngine)).unwrap();
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
}
