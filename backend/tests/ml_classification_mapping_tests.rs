//! Fixture-based tests for feature/category mapping in `services::ml_classification`
//! (issue #1480). Exercises the public mapping surface only.

use chrono::Utc;
use scavenger_backend::services::ml_classification::{
    ClassificationPrediction, ClassificationRequest, ClassificationService, MockInferenceEngine, ModelVersion,
    WasteCategory,
};
use std::sync::Arc;

const ALL_CATEGORIES: [(WasteCategory, &str); 8] = [
    (WasteCategory::Plastic, "plastic"),
    (WasteCategory::Paper, "paper"),
    (WasteCategory::Metal, "metal"),
    (WasteCategory::Glass, "glass"),
    (WasteCategory::Organic, "organic"),
    (WasteCategory::Electronic, "electronic"),
    (WasteCategory::Hazardous, "hazardous"),
    (WasteCategory::Other, "other"),
];

#[test]
fn every_category_maps_to_its_snake_case_label() {
    for (category, label) in ALL_CATEGORIES {
        assert_eq!(category.as_str(), label);
    }
}

#[test]
fn every_category_serialises_to_the_same_label_as_as_str() {
    for (category, label) in ALL_CATEGORIES {
        let json = serde_json::to_string(&category).expect("category serialises");
        assert_eq!(json, format!("\"{label}\""));
    }
}

#[test]
fn every_category_round_trips_through_serde() {
    for (category, _) in ALL_CATEGORIES {
        let json = serde_json::to_string(&category).expect("category serialises");
        let back: WasteCategory = serde_json::from_str(&json).expect("category deserialises");
        assert_eq!(back, category);
    }
}

#[test]
fn prediction_fixture_round_trips_with_category_and_confidence() {
    let fixture = ClassificationPrediction {
        category: WasteCategory::Glass,
        confidence: 0.5,
    };
    let json = serde_json::to_value(&fixture).expect("prediction serialises");
    assert_eq!(json["category"], "glass");
    assert_eq!(json["confidence"], 0.5);
}

fn ready_service() -> ClassificationService {
    let service = ClassificationService::new();
    service
        .register_version(
            ModelVersion {
                version_id: "v1".to_string(),
                model_name: "waste-classifier".to_string(),
                version: "1.0.0".to_string(),
                description: "fixture".to_string(),
                is_active: false,
                created_at: Utc::now(),
                accuracy: 0.85,
            },
            Arc::new(MockInferenceEngine),
        )
        .expect("version registers");
    service.promote_version("v1").expect("version promotes");
    service
}

async fn classify_fixture(service: &ClassificationService) -> scavenger_backend::services::ml_classification::ClassificationResult {
    service
        .classify(ClassificationRequest {
            image: "fixture-image".to_string(),
            model_version_id: None,
        })
        .await
        .expect("classification succeeds")
}

#[tokio::test]
async fn classify_maps_mock_engine_fixture_to_top_prediction() {
    let result = classify_fixture(&ready_service()).await;

    assert_eq!(result.top_prediction.category, WasteCategory::Plastic);
    assert!((result.top_prediction.confidence - 0.82).abs() < f64::EPSILON);
    assert_eq!(result.all_predictions.len(), 4);
    assert_eq!(result.all_predictions[0].category, result.top_prediction.category);
}

#[tokio::test]
async fn classify_orders_fixture_predictions_by_confidence_descending() {
    let result = classify_fixture(&ready_service()).await;

    let confidences: Vec<f64> = result.all_predictions.iter().map(|p| p.confidence).collect();
    let mut sorted = confidences.clone();
    sorted.sort_by(|a, b| b.partial_cmp(a).expect("confidences are finite"));
    assert_eq!(confidences, sorted);
}
