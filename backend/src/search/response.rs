//! #1088: result-formatting logic extracted from `api/search.rs`, separate
//! from query building (`request.rs`) and from index/pipeline mechanics.
//! Turns a raw Elasticsearch `_search` response body into the API-facing
//! shape, tolerating a partial/malformed body rather than erroring — a
//! missing field here should degrade to empty output, not fail the request.

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
pub struct SearchResponse<T> {
    pub total: u64,
    pub hits: Vec<T>,
    pub took_ms: u64,
    pub facets: Option<Value>,
}

/// Format one Elasticsearch hit into the flattened shape returned by the
/// API: the `_source` document plus `_id`, `_score`, and any `highlight`.
fn format_hit(hit: &Value) -> Value {
    let mut source = hit.get("_source").cloned().unwrap_or(Value::Null);

    if let Some(obj) = source.as_object_mut() {
        obj.insert("_id".to_string(), hit.get("_id").cloned().unwrap_or(Value::Null));
        obj.insert("_score".to_string(), hit.get("_score").cloned().unwrap_or(Value::Null));
        if let Some(highlight) = hit.get("highlight") {
            obj.insert("_highlight".to_string(), highlight.clone());
        }
    }

    source
}

/// Format a raw Elasticsearch `_search` response body into a `SearchResponse`.
pub fn format_search_response(es_body: &Value, took_ms: u64) -> SearchResponse<Value> {
    let total = es_body["hits"]["total"]["value"].as_u64().unwrap_or(0);

    let hits = es_body["hits"]["hits"]
        .as_array()
        .map(|arr| arr.iter().map(format_hit).collect())
        .unwrap_or_default();

    let facets = es_body.get("aggregations").cloned();

    SearchResponse {
        total,
        hits,
        took_ms,
        facets,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn formats_hits_with_id_score_and_source_merged() {
        let body = json!({
            "hits": {
                "total": { "value": 1 },
                "hits": [
                    { "_id": "abc", "_score": 1.5, "_source": { "title": "Bin" } }
                ]
            }
        });

        let response = format_search_response(&body, 12);
        assert_eq!(response.total, 1);
        assert_eq!(response.took_ms, 12);
        assert_eq!(response.hits.len(), 1);
        assert_eq!(response.hits[0]["title"], "Bin");
        assert_eq!(response.hits[0]["_id"], "abc");
        assert_eq!(response.hits[0]["_score"], 1.5);
    }

    #[test]
    fn includes_highlight_when_present() {
        let body = json!({
            "hits": {
                "total": { "value": 1 },
                "hits": [
                    {
                        "_id": "abc",
                        "_score": 1.0,
                        "_source": { "title": "Bin" },
                        "highlight": { "title": ["<em>Bin</em>"] }
                    }
                ]
            }
        });

        let response = format_search_response(&body, 0);
        assert_eq!(response.hits[0]["_highlight"]["title"][0], "<em>Bin</em>");
    }

    #[test]
    fn empty_or_malformed_body_degrades_to_empty_result() {
        let response = format_search_response(&json!({}), 3);
        assert_eq!(response.total, 0);
        assert!(response.hits.is_empty());
        assert!(response.facets.is_none());
        assert_eq!(response.took_ms, 3);
    }

    #[test]
    fn surfaces_aggregations_as_facets() {
        let body = json!({
            "hits": { "total": { "value": 0 }, "hits": [] },
            "aggregations": { "status": { "buckets": [] } }
        });

        let response = format_search_response(&body, 0);
        assert!(response.facets.is_some());
    }
}
