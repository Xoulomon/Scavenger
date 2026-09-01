use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

/// Search query types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum QueryType {
    Match { field: String, query: String },
    MultiMatch { fields: Vec<String>, query: String },
    Term { field: String, value: Value },
    Range { field: String, gte: Option<Value>, lte: Option<Value>, gt: Option<Value>, lt: Option<Value> },
    Bool { must: Vec<QueryType>, should: Vec<QueryType>, must_not: Vec<QueryType> },
    Wildcard { field: String, value: String },
    Prefix { field: String, value: String },
    Fuzzy { field: String, value: String, fuzziness: Option<String> },
    MatchAll,
}

/// Main search query structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: QueryType,
    pub from: usize,
    pub size: usize,
    pub sort: Option<Vec<Value>>,
    pub highlight: Option<Value>,
    pub aggregations: Option<HashMap<String, Value>>,
    #[serde(rename = "_source")]
    pub source: Option<Vec<String>>,
}

impl Default for SearchQuery {
    fn default() -> Self {
        Self {
            query: QueryType::MatchAll,
            from: 0,
            size: 20,
            sort: None,
            highlight: None,
            aggregations: None,
            source: None,
        }
    }
}

/// Builder for constructing search queries
pub struct SearchQueryBuilder {
    query: SearchQuery,
}

impl SearchQueryBuilder {
    pub fn new() -> Self {
        Self {
            query: SearchQuery::default(),
        }
    }

    /// Set the main query
    pub fn query(mut self, query: QueryType) -> Self {
        self.query.query = query;
        self
    }

    /// Match query on a single field
    pub fn match_query(mut self, field: impl Into<String>, query: impl Into<String>) -> Self {
        self.query.query = QueryType::Match {
            field: field.into(),
            query: query.into(),
        };
        self
    }

    /// Multi-match query across multiple fields
    pub fn multi_match(mut self, fields: Vec<String>, query: impl Into<String>) -> Self {
        self.query.query = QueryType::MultiMatch {
            fields,
            query: query.into(),
        };
        self
    }

    /// Term query for exact matches
    pub fn term(mut self, field: impl Into<String>, value: Value) -> Self {
        self.query.query = QueryType::Term {
            field: field.into(),
            value,
        };
        self
    }

    /// Boolean query combining multiple conditions
    pub fn bool_query(
        mut self,
        must: Vec<QueryType>,
        should: Vec<QueryType>,
        must_not: Vec<QueryType>,
    ) -> Self {
        self.query.query = QueryType::Bool { must, should, must_not };
        self
    }

    /// Set pagination offset
    pub fn from(mut self, from: usize) -> Self {
        self.query.from = from;
        self
    }

    /// Set page size
    pub fn size(mut self, size: usize) -> Self {
        self.query.size = size;
        self
    }

    /// Add sorting
    pub fn sort(mut self, field: impl Into<String>, order: impl Into<String>) -> Self {
        let sort_obj = json!({ field.into(): { "order": order.into() } });

        match &mut self.query.sort {
            Some(sorts) => sorts.push(sort_obj),
            None => self.query.sort = Some(vec![sort_obj]),
        }

        self
    }

    /// Add highlighting
    pub fn highlight(mut self, fields: Vec<String>) -> Self {
        let mut highlight_fields = HashMap::new();
        for field in fields {
            highlight_fields.insert(field, json!({}));
        }

        self.query.highlight = Some(json!({
            "fields": highlight_fields,
            "pre_tags": ["<em>"],
            "post_tags": ["</em>"],
        }));

        self
    }

    /// Add aggregation
    pub fn aggregation(mut self, name: impl Into<String>, agg: Value) -> Self {
        match &mut self.query.aggregations {
            Some(aggs) => {
                aggs.insert(name.into(), agg);
            }
            None => {
                let mut aggs = HashMap::new();
                aggs.insert(name.into(), agg);
                self.query.aggregations = Some(aggs);
            }
        }

        self
    }

    /// Specify which fields to return
    pub fn source(mut self, fields: Vec<String>) -> Self {
        self.query.source = Some(fields);
        self
    }

    /// Build the final query
    pub fn build(self) -> SearchQuery {
        self.query
    }

    /// Convert to Elasticsearch JSON
    pub fn to_elasticsearch_json(&self) -> Value {
        let mut body = json!({
            "from": self.query.from,
            "size": self.query.size,
        });

        // Add query
        body["query"] = self.query_type_to_json(&self.query.query);

        // Add optional fields
        if let Some(ref sort) = self.query.sort {
            body["sort"] = json!(sort);
        }

        if let Some(ref highlight) = self.query.highlight {
            body["highlight"] = highlight.clone();
        }

        if let Some(ref aggs) = self.query.aggregations {
            body["aggs"] = json!(aggs);
        }

        if let Some(ref source) = self.query.source {
            body["_source"] = json!(source);
        }

        body
    }

    fn query_type_to_json(&self, query_type: &QueryType) -> Value {
        match query_type {
            QueryType::MatchAll => json!({ "match_all": {} }),
            QueryType::Match { field, query } => json!({
                "match": { field: query }
            }),
            QueryType::MultiMatch { fields, query } => json!({
                "multi_match": {
                    "query": query,
                    "fields": fields
                }
            }),
            QueryType::Term { field, value } => json!({
                "term": { field: value }
            }),
            QueryType::Range { field, gte, lte, gt, lt } => {
                let mut range = serde_json::Map::new();
                if let Some(v) = gte { range.insert("gte".to_string(), v.clone()); }
                if let Some(v) = lte { range.insert("lte".to_string(), v.clone()); }
                if let Some(v) = gt { range.insert("gt".to_string(), v.clone()); }
                if let Some(v) = lt { range.insert("lt".to_string(), v.clone()); }
                json!({ "range": { field: range } })
            }
            QueryType::Bool { must, should, must_not } => {
                let mut bool_query = serde_json::Map::new();

                if !must.is_empty() {
                    let must_queries: Vec<Value> = must.iter()
                        .map(|q| self.query_type_to_json(q))
                        .collect();
                    bool_query.insert("must".to_string(), json!(must_queries));
                }

                if !should.is_empty() {
                    let should_queries: Vec<Value> = should.iter()
                        .map(|q| self.query_type_to_json(q))
                        .collect();
                    bool_query.insert("should".to_string(), json!(should_queries));
                }

                if !must_not.is_empty() {
                    let must_not_queries: Vec<Value> = must_not.iter()
                        .map(|q| self.query_type_to_json(q))
                        .collect();
                    bool_query.insert("must_not".to_string(), json!(must_not_queries));
                }

                json!({ "bool": bool_query })
            }
            QueryType::Wildcard { field, value } => json!({
                "wildcard": { field: value }
            }),
            QueryType::Prefix { field, value } => json!({
                "prefix": { field: value }
            }),
            QueryType::Fuzzy { field, value, fuzziness } => {
                let mut fuzzy = serde_json::Map::new();
                fuzzy.insert("value".to_string(), json!(value));
                if let Some(f) = fuzziness {
                    fuzzy.insert("fuzziness".to_string(), json!(f));
                }
                json!({ "fuzzy": { field: fuzzy } })
            }
        }
    }
}

impl Default for SearchQueryBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_query() {
        let query = SearchQueryBuilder::new()
            .match_query("title", "test")
            .build();

        match query.query {
            QueryType::Match { field, query } => {
                assert_eq!(field, "title");
                assert_eq!(query, "test");
            }
            _ => panic!("Expected Match query"),
        }
    }

    #[test]
    fn test_pagination() {
        let query = SearchQueryBuilder::new()
            .from(10)
            .size(50)
            .build();

        assert_eq!(query.from, 10);
        assert_eq!(query.size, 50);
    }

    #[test]
    fn test_bool_query() {
        let query = SearchQueryBuilder::new()
            .bool_query(
                vec![QueryType::Term { field: "status".to_string(), value: json!("active") }],
                vec![],
                vec![],
            )
            .build();

        match query.query {
            QueryType::Bool { must, .. } => {
                assert_eq!(must.len(), 1);
            }
            _ => panic!("Expected Bool query"),
        }
    }
}
