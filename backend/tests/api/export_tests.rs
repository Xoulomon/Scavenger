//! Integration tests for export endpoints.
//!
//! Pure struct/serde round-trip checks (format (de)serialization, response
//! shape) were removed here — they are unit-test-shaped assertions with no
//! HTTP/router/state involved and are covered by unit tests colocated with
//! `scavenger_backend::api::export`. See `README_ISSUE1_TEST_DEDUP.md` at the
//! repo root for the full audit. What remains here is the one case that
//! actually needs integration-level context (constructing an `ExportResponse`
//! as it would appear on the wire).

use serde_json::json;

use scavenger_backend::api::export::{ExportFormat, ExportResponse};

#[tokio::test]
async fn test_export_waste_json_wire_shape() {
    let response = ExportResponse {
        success: true,
        data: Some(json!({ "test": "data" })),
        message: "Success".to_string(),
        format: "json".to_string(),
        record_count: 5,
    };

    let value = serde_json::to_value(&response).unwrap();
    assert_eq!(value["success"], true);
    assert_eq!(value["format"], "json");
    assert_eq!(value["record_count"], 5);
}

#[tokio::test]
async fn test_export_format_round_trip() {
    for fmt in [ExportFormat::Csv, ExportFormat::Json] {
        let json = serde_json::to_string(&fmt).unwrap();
        let back: ExportFormat = serde_json::from_str(&json).unwrap();
        assert_eq!(format!("{:?}", fmt), format!("{:?}", back));
    }
}
