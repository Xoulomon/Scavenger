use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

/// Facet configuration for aggregations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Facet {
    pub field: String,
    pub size: usize,
    pub facet_type: FacetType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FacetType {
    Terms,
    Range { ranges: Vec<FacetRange> },
    DateHistogram { interval: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacetRange {
    pub from: Option<Value>,
    pub to: Option<Value>,
    pub label: String,
}

/// Facet result from aggregation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacetResult {
    pub value: String,
    pub count: u64,
}

/// Faceted search handler
pub struct FacetedSearch;

impl FacetedSearch {
    /// Build aggregation query from facet configuration
    pub fn build_aggregations(facets: &[Facet]) -> HashMap<String, Value> {
        let mut aggs = HashMap::new();

        for facet in facets {
            let agg_value = match &facet.facet_type {
                FacetType::Terms => {
                    json!({
                        "terms": {
                            "field": format!("{}.keyword", facet.field),
                            "size": facet.size
                        }
                    })
                }
                FacetType::Range { ranges } => {
                    let range_specs: Vec<Value> = ranges.iter().map(|r| {
                        let mut spec = serde_json::Map::new();
                        if let Some(ref from) = r.from {
                            spec.insert("from".to_string(), from.clone());
                        }
                        if let Some(ref to) = r.to {
                            spec.insert("to".to_string(), to.clone());
                        }
                        spec.insert("key".to_string(), json!(r.label));
                        Value::Object(spec)
                    }).collect();

                    json!({
                        "range": {
                            "field": facet.field,
                            "ranges": range_specs
                        }
                    })
                }
                FacetType::DateHistogram { interval } => {
                    json!({
                        "date_histogram": {
                            "field": facet.field,
                            "calendar_interval": interval
                        }
                    })
                }
            };

            aggs.insert(facet.field.clone(), agg_value);
        }

        aggs
    }
}
