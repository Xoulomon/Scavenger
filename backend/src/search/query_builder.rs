//! Typed, parameter-bound Elasticsearch query builder.
//!
//! Every user-supplied *value* that flows into a query is collected into a
//! separate parameter vector and referenced by a positional placeholder
//! (`$1`, `$2`, …) in the generated body — it is never string-interpolated
//! into the query text. Field names are restricted to the closed
//! [`SearchField`] enum, so untrusted field strings are rejected at the
//! type boundary and can never reach the query body. Together these two
//! guarantees make injection regressions structurally impossible: a
//! reviewer can confirm safety by checking that (a) the parameterized body
//! contains only placeholders where values go and (b) the placeholder count
//! equals the parameter count (enforced by a property test).
//!
//! See `docs/QUERY_OPTIMIZATION.md` for the typed-query model this mirrors.

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

use super::SortOrder;

/// Closed set of search field identifiers.
///
/// Replaces free-form `String` field names in [`QueryType`]. Because only
/// known variants can be constructed, an attacker-supplied field name can
/// never become a query clause key — [`SearchField::from_name`] returns
/// `None` for anything that is not a recognised field.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SearchField {
    Title,
    Description,
    Body,
    Content,
    Status,
    #[serde(rename = "type")]
    WasteType,
    Category,
    Name,
    Sku,
    CreatedAt,
    Score,
    #[serde(rename = "_score")]
    RelevanceScore,
    Id,
    Priority,
    Archived,
    Weight,
    Count,
    Participant,
    Tags,
}

impl SearchField {
    /// The Elasticsearch field name for this field.
    #[must_use]
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Title => "title",
            Self::Description => "description",
            Self::Body => "body",
            Self::Content => "content",
            Self::Status => "status",
            Self::WasteType => "type",
            Self::Category => "category",
            Self::Name => "name",
            Self::Sku => "sku",
            Self::CreatedAt => "created_at",
            Self::Score => "score",
            Self::RelevanceScore => "_score",
            Self::Id => "id",
            Self::Priority => "priority",
            Self::Archived => "archived",
            Self::Weight => "weight",
            Self::Count => "count",
            Self::Participant => "participant",
            Self::Tags => "tags",
        }
    }

    /// Parse a raw field name into a [`SearchField`].
    ///
    /// Returns `None` for unknown names so that untrusted field strings —
    /// including injection payloads — can be dropped before they ever reach
    /// the query body.
    #[must_use]
    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "title" => Some(Self::Title),
            "description" => Some(Self::Description),
            "body" => Some(Self::Body),
            "content" => Some(Self::Content),
            "status" => Some(Self::Status),
            "type" => Some(Self::WasteType),
            "category" => Some(Self::Category),
            "name" => Some(Self::Name),
            "sku" => Some(Self::Sku),
            "created_at" => Some(Self::CreatedAt),
            "score" => Some(Self::Score),
            "_score" => Some(Self::RelevanceScore),
            "id" => Some(Self::Id),
            "priority" => Some(Self::Priority),
            "archived" => Some(Self::Archived),
            "weight" => Some(Self::Weight),
            "count" => Some(Self::Count),
            "participant" => Some(Self::Participant),
            "tags" => Some(Self::Tags),
            _ => None,
        }
    }
}

/// A single sort clause: a typed field and a sort order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SortClause {
    pub field: SearchField,
    pub order: SortOrder,
}

impl SortClause {
    #[must_use]
    pub const fn new(field: SearchField, order: SortOrder) -> Self {
        Self { field, order }
    }

    /// Render this clause as the Elasticsearch sort object `{ field: { "order": … } }`.
    #[must_use]
    pub fn to_json(&self) -> Value {
        let mut inner = Map::new();
        inner.insert("order".to_string(), Value::String(self.order.as_str().to_string()));
        let mut outer = Map::new();
        outer.insert(self.field.as_str().to_string(), Value::Object(inner));
        Value::Object(outer)
    }
}

/// A query body with values separated into bound parameters.
///
/// `body` contains positional placeholders (`$1`, `$2`, …) wherever a
/// user-supplied value belongs; `params` holds those values in order. The
/// body itself never contains user input — only structured clauses and
/// placeholders — which is what makes the query injection-safe.
#[derive(Debug, Clone, PartialEq)]
pub struct ParameterizedQuery {
    pub body: Value,
    pub params: Vec<Value>,
}

/// Search query types.
///
/// Field positions use the typed [`SearchField`] enum rather than strings,
/// so query clauses can only ever reference known, validated fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum QueryType {
    Match {
        field: SearchField,
        query: String,
    },
    MultiMatch {
        fields: Vec<SearchField>,
        query: String,
    },
    Term {
        field: SearchField,
        value: Value,
    },
    Range {
        field: SearchField,
        gte: Option<Value>,
        lte: Option<Value>,
        gt: Option<Value>,
        lt: Option<Value>,
    },
    Bool {
        must: Vec<QueryType>,
        should: Vec<QueryType>,
        must_not: Vec<QueryType>,
    },
    Wildcard {
        field: SearchField,
        value: String,
    },
    Prefix {
        field: SearchField,
        value: String,
    },
    Fuzzy {
        field: SearchField,
        value: String,
        fuzziness: Option<String>,
    },
    MatchAll,
}

/// Main search query structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: QueryType,
    pub from: usize,
    pub size: usize,
    pub sort: Option<Vec<SortClause>>,
    pub highlight: Option<Value>,
    pub aggregations: Option<HashMap<String, Value>>,
    #[serde(rename = "_source")]
    pub source: Option<Vec<SearchField>>,
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

/// Builder for constructing search queries.
pub struct SearchQueryBuilder {
    query: SearchQuery,
}

impl SearchQueryBuilder {
    /// Create a new builder with default settings (match-all, page 0/size 20).
    #[must_use]
    pub fn new() -> Self {
        Self {
            query: SearchQuery::default(),
        }
    }

    /// Set the main query.
    #[must_use]
    pub fn query(mut self, query: QueryType) -> Self {
        self.query.query = query;
        self
    }

    /// Match query on a single field.
    #[must_use]
    pub fn match_query(mut self, field: SearchField, query: impl Into<String>) -> Self {
        self.query.query = QueryType::Match {
            field,
            query: query.into(),
        };
        self
    }

    /// Multi-match query across multiple fields.
    #[must_use]
    pub fn multi_match(mut self, fields: Vec<SearchField>, query: impl Into<String>) -> Self {
        self.query.query = QueryType::MultiMatch {
            fields,
            query: query.into(),
        };
        self
    }

    /// Term query for exact matches.
    #[must_use]
    pub fn term(mut self, field: SearchField, value: Value) -> Self {
        self.query.query = QueryType::Term { field, value };
        self
    }

    /// Boolean query combining multiple conditions.
    #[must_use]
    pub fn bool_query(
        mut self,
        must: Vec<QueryType>,
        should: Vec<QueryType>,
        must_not: Vec<QueryType>,
    ) -> Self {
        self.query.query = QueryType::Bool {
            must,
            should,
            must_not,
        };
        self
    }

    /// Set pagination offset.
    #[must_use]
    pub fn from(mut self, from: usize) -> Self {
        self.query.from = from;
        self
    }

    /// Set page size.
    #[must_use]
    pub fn size(mut self, size: usize) -> Self {
        self.query.size = size;
        self
    }

    /// Add sorting on a typed field.
    #[must_use]
    pub fn sort(mut self, field: SearchField, order: SortOrder) -> Self {
        let clause = SortClause::new(field, order);
        match &mut self.query.sort {
            Some(sorts) => sorts.push(clause),
            None => self.query.sort = Some(vec![clause]),
        }
        self
    }

    /// Add highlighting to the given fields.
    #[must_use]
    pub fn highlight(mut self, fields: Vec<SearchField>) -> Self {
        let mut highlight_fields = Map::new();
        for field in fields {
            highlight_fields.insert(field.as_str().to_string(), json!({}));
        }

        self.query.highlight = Some(json!({
            "fields": highlight_fields,
            "pre_tags": ["<em>"],
            "post_tags": ["</em>"],
        }));

        self
    }

    /// Add an aggregation under `name`.
    #[must_use]
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

    /// Specify which fields to return.
    #[must_use]
    pub fn source(mut self, fields: Vec<SearchField>) -> Self {
        self.query.source = Some(fields);
        self
    }

    /// Build the final query.
    #[must_use]
    pub fn build(self) -> SearchQuery {
        self.query
    }

    /// Convert to Elasticsearch JSON with values inlined.
    ///
    /// This is the representation sent to the cluster. It is produced from
    /// the same code path as [`Self::to_parameterized`], only with the
    /// bind mode set to inline, so the two cannot diverge structurally.
    #[must_use]
    pub fn to_elasticsearch_json(&self) -> Value {
        self.build_body(false).0
    }

    /// Convert to a parameterized query body with bound parameters.
    ///
    /// The returned `body` contains `$N` placeholders wherever a value
    /// belongs and `params` holds the values in order. The body never
    /// contains user input.
    #[must_use]
    pub fn to_parameterized(&self) -> ParameterizedQuery {
        let (body, params) = self.build_body(true);
        ParameterizedQuery { body, params }
    }

    /// Build the query body, binding values as placeholders (`parameterized`)
    /// or inlining them (`!parameterized`). Pagination and every leaf value
    /// in the query tree are routed through [`bind_value`] so that all
    /// user-supplied data flows through a single, auditable path.
    fn build_body(&self, parameterized: bool) -> (Value, Vec<Value>) {
        let mut params: Vec<Value> = Vec::new();
        let mut body = Map::new();

        body.insert("from".to_string(), bind_usize(self.query.from, &mut params, parameterized));
        body.insert("size".to_string(), bind_usize(self.query.size, &mut params, parameterized));
        body.insert(
            "query".to_string(),
            query_type_to_json(&self.query.query, &mut params, parameterized),
        );

        if let Some(sort) = &self.query.sort {
            body.insert("sort".to_string(), sort_to_json(sort));
        }
        if let Some(highlight) = &self.query.highlight {
            body.insert(
                "highlight".to_string(),
                bind_value(highlight.clone(), &mut params, parameterized),
            );
        }
        if let Some(aggs) = &self.query.aggregations {
            body.insert(
                "aggs".to_string(),
                bind_value(json!(aggs), &mut params, parameterized),
            );
        }
        if let Some(source) = &self.query.source {
            body.insert("_source".to_string(), json!(source));
        }

        (Value::Object(body), params)
    }
}

impl Default for SearchQueryBuilder {
    fn default() -> Self {
        Self::new()
    }
}

// ── query rendering helpers ──────────────────────────────────────────────

/// Either push `value` as a bound parameter and return its placeholder, or
/// return `value` inline. All user-supplied values pass through here.
fn bind_value(value: Value, params: &mut Vec<Value>, parameterized: bool) -> Value {
    if parameterized {
        params.push(value);
        Value::String(placeholder(params.len()))
    } else {
        value
    }
}

/// `bind_value` for a `usize` (pagination), converting to a JSON number first.
fn bind_usize(n: usize, params: &mut Vec<Value>, parameterized: bool) -> Value {
    bind_value(Value::from(n), params, parameterized)
}

/// A 1-indexed placeholder string, e.g. `"$3"`. Uses `params.len()` after the
/// push so no arithmetic is required.
fn placeholder(n: usize) -> String {
    format!("${}", n)
}

/// Build the `{ clause: { field: value } }` shape used by match/term/etc.
fn field_value_clause(
    clause: &str,
    field: SearchField,
    value: Value,
    params: &mut Vec<Value>,
    parameterized: bool,
) -> Value {
    let mut inner = Map::new();
    inner.insert(field.as_str().to_string(), bind_value(value, params, parameterized));
    let mut outer = Map::new();
    outer.insert(clause.to_string(), Value::Object(inner));
    Value::Object(outer)
}

/// Render a multi_match clause: query value is bound, field names are inline.
fn multi_match_to_json(
    fields: &[SearchField],
    query: &str,
    params: &mut Vec<Value>,
    parameterized: bool,
) -> Value {
    let field_names: Vec<Value> =
        fields.iter().map(|f| Value::String(f.as_str().to_string())).collect();
    let mut inner = Map::new();
    inner.insert(
        "query".to_string(),
        bind_value(Value::String(query.to_string()), params, parameterized),
    );
    inner.insert("fields".to_string(), Value::Array(field_names));
    let mut outer = Map::new();
    outer.insert("multi_match".to_string(), Value::Object(inner));
    Value::Object(outer)
}

/// Render a range clause: each present bound is bound as a parameter.
fn range_to_json(
    field: SearchField,
    gte: &Option<Value>,
    lte: &Option<Value>,
    gt: &Option<Value>,
    lt: &Option<Value>,
    params: &mut Vec<Value>,
    parameterized: bool,
) -> Value {
    let mut inner = Map::new();
    if let Some(v) = gte {
        inner.insert("gte".to_string(), bind_value(v.clone(), params, parameterized));
    }
    if let Some(v) = lte {
        inner.insert("lte".to_string(), bind_value(v.clone(), params, parameterized));
    }
    if let Some(v) = gt {
        inner.insert("gt".to_string(), bind_value(v.clone(), params, parameterized));
    }
    if let Some(v) = lt {
        inner.insert("lt".to_string(), bind_value(v.clone(), params, parameterized));
    }
    let mut wrapper = Map::new();
    wrapper.insert(field.as_str().to_string(), Value::Object(inner));
    let mut outer = Map::new();
    outer.insert("range".to_string(), Value::Object(wrapper));
    Value::Object(outer)
}

/// Render a bool clause, recursing into each nested query.
fn bool_to_json(
    must: &[QueryType],
    should: &[QueryType],
    must_not: &[QueryType],
    params: &mut Vec<Value>,
    parameterized: bool,
) -> Value {
    let mut inner = Map::new();
    if !must.is_empty() {
        inner.insert(
            "must".to_string(),
            Value::Array(
                must.iter()
                    .map(|q| query_type_to_json(q, params, parameterized))
                    .collect(),
            ),
        );
    }
    if !should.is_empty() {
        inner.insert(
            "should".to_string(),
            Value::Array(
                should
                    .iter()
                    .map(|q| query_type_to_json(q, params, parameterized))
                    .collect(),
            ),
        );
    }
    if !must_not.is_empty() {
        inner.insert(
            "must_not".to_string(),
            Value::Array(
                must_not
                    .iter()
                    .map(|q| query_type_to_json(q, params, parameterized))
                    .collect(),
            ),
        );
    }
    let mut outer = Map::new();
    outer.insert("bool".to_string(), Value::Object(inner));
    Value::Object(outer)
}

/// Render a fuzzy clause: value and optional fuzziness are bound as params.
fn fuzzy_to_json(
    field: SearchField,
    value: &str,
    fuzziness: Option<&str>,
    params: &mut Vec<Value>,
    parameterized: bool,
) -> Value {
    let mut inner = Map::new();
    inner.insert(
        "value".to_string(),
        bind_value(Value::String(value.to_string()), params, parameterized),
    );
    if let Some(f) = fuzziness {
        inner.insert(
            "fuzziness".to_string(),
            bind_value(Value::String(f.to_string()), params, parameterized),
        );
    }
    let mut wrapper = Map::new();
    wrapper.insert(field.as_str().to_string(), Value::Object(inner));
    let mut outer = Map::new();
    outer.insert("fuzzy".to_string(), Value::Object(wrapper));
    Value::Object(outer)
}

/// Render a query type to JSON, binding leaf values through `bind_value`.
fn query_type_to_json(qt: &QueryType, params: &mut Vec<Value>, parameterized: bool) -> Value {
    match qt {
        QueryType::MatchAll => json!({ "match_all": {} }),
        QueryType::Match { field, query } => {
            field_value_clause("match", *field, Value::String(query.clone()), params, parameterized)
        }
        QueryType::MultiMatch { fields, query } => {
            multi_match_to_json(fields, query, params, parameterized)
        }
        QueryType::Term { field, value } => {
            field_value_clause("term", *field, value.clone(), params, parameterized)
        }
        QueryType::Range { field, gte, lte, gt, lt } => {
            range_to_json(*field, gte, lte, gt, lt, params, parameterized)
        }
        QueryType::Bool { must, should, must_not } => {
            bool_to_json(must, should, must_not, params, parameterized)
        }
        QueryType::Wildcard { field, value } => {
            field_value_clause("wildcard", *field, Value::String(value.clone()), params, parameterized)
        }
        QueryType::Prefix { field, value } => {
            field_value_clause("prefix", *field, Value::String(value.clone()), params, parameterized)
        }
        QueryType::Fuzzy { field, value, fuzziness } => {
            fuzzy_to_json(*field, value, fuzziness.as_deref(), params, parameterized)
        }
    }
}

/// Render sort clauses as a JSON array.
fn sort_to_json(sort: &[SortClause]) -> Value {
    Value::Array(sort.iter().map(SortClause::to_json).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // ── SearchField ───────────────────────────────────────────────────────

    #[test]
    fn field_as_str_round_trips_through_from_name() {
        let all = [
            SearchField::Title,
            SearchField::Description,
            SearchField::Body,
            SearchField::Content,
            SearchField::Status,
            SearchField::WasteType,
            SearchField::Category,
            SearchField::Name,
            SearchField::Sku,
            SearchField::CreatedAt,
            SearchField::Score,
            SearchField::RelevanceScore,
            SearchField::Id,
            SearchField::Priority,
            SearchField::Archived,
            SearchField::Weight,
            SearchField::Count,
            SearchField::Participant,
            SearchField::Tags,
        ];
        for f in all {
            assert_eq!(SearchField::from_name(f.as_str()), Some(f));
        }
    }

    #[test]
    fn from_name_rejects_unknown_and_injection_field_names() {
        // With typed fields, an attacker cannot name an arbitrary field —
        // these are all rejected before they reach the query body.
        assert_eq!(SearchField::from_name("nope"), None);
        assert_eq!(SearchField::from_name(r#"title"; DROP TABLE items; --"#), None);
        assert_eq!(SearchField::from_name("should"), None);
        assert_eq!(SearchField::from_name(""), None);
        assert_eq!(SearchField::from_name("Title"), None); // case-sensitive
    }

    // ── basic builder behaviour ──────────────────────────────────────────

    #[test]
    fn test_match_query() {
        let query = SearchQueryBuilder::new().match_query(SearchField::Title, "test").build();

        match query.query {
            QueryType::Match { field, query } => {
                assert_eq!(field, SearchField::Title);
                assert_eq!(query, "test");
            }
            _ => panic!("Expected Match query"),
        }
    }

    #[test]
    fn test_pagination() {
        let query = SearchQueryBuilder::new().from(10).size(50).build();

        assert_eq!(query.from, 10);
        assert_eq!(query.size, 50);
    }

    #[test]
    fn test_bool_query() {
        let query = SearchQueryBuilder::new()
            .bool_query(
                vec![QueryType::Term {
                    field: SearchField::Status,
                    value: json!("active"),
                }],
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

    // ── filter query type JSON ───────────────────────────────────────────

    #[test]
    fn test_multi_match_query_json() {
        let builder =
            SearchQueryBuilder::new().multi_match(vec![SearchField::Title, SearchField::Body], "recycling");
        assert_eq!(
            builder.to_elasticsearch_json()["query"],
            json!({ "multi_match": { "query": "recycling", "fields": ["title", "body"] } })
        );
    }

    #[test]
    fn test_term_query_json() {
        let builder = SearchQueryBuilder::new().term(SearchField::Status, json!("active"));
        assert_eq!(
            builder.to_elasticsearch_json()["query"],
            json!({ "term": { "status": "active" } })
        );
    }

    #[test]
    fn test_range_query_json_with_all_bounds() {
        let builder = SearchQueryBuilder::new().query(QueryType::Range {
            field: SearchField::CreatedAt,
            gte: Some(json!("2024-01-01")),
            lte: Some(json!("2024-12-31")),
            gt: None,
            lt: None,
        });
        assert_eq!(
            builder.to_elasticsearch_json()["query"],
            json!({ "range": { "created_at": { "gte": "2024-01-01", "lte": "2024-12-31" } } })
        );
    }

    #[test]
    fn test_range_query_json_omits_unset_bounds() {
        let builder = SearchQueryBuilder::new().query(QueryType::Range {
            field: SearchField::Score,
            gte: None,
            lte: None,
            gt: Some(json!(1)),
            lt: None,
        });
        assert_eq!(
            builder.to_elasticsearch_json()["query"],
            json!({ "range": { "score": { "gt": 1 } } })
        );
    }

    #[test]
    fn test_wildcard_query_json() {
        let builder = SearchQueryBuilder::new().query(QueryType::Wildcard {
            field: SearchField::Sku,
            value: "PLA-*".to_string(),
        });
        assert_eq!(
            builder.to_elasticsearch_json()["query"],
            json!({ "wildcard": { "sku": "PLA-*" } })
        );
    }

    #[test]
    fn test_prefix_query_json() {
        let builder = SearchQueryBuilder::new().query(QueryType::Prefix {
            field: SearchField::Category,
            value: "plas".to_string(),
        });
        assert_eq!(
            builder.to_elasticsearch_json()["query"],
            json!({ "prefix": { "category": "plas" } })
        );
    }

    #[test]
    fn test_fuzzy_query_json_with_fuzziness() {
        let builder = SearchQueryBuilder::new().query(QueryType::Fuzzy {
            field: SearchField::Name,
            value: "plastik".to_string(),
            fuzziness: Some("AUTO".to_string()),
        });
        assert_eq!(
            builder.to_elasticsearch_json()["query"],
            json!({ "fuzzy": { "name": { "value": "plastik", "fuzziness": "AUTO" } } })
        );
    }

    #[test]
    fn test_fuzzy_query_json_without_fuzziness() {
        let builder = SearchQueryBuilder::new().query(QueryType::Fuzzy {
            field: SearchField::Name,
            value: "plastik".to_string(),
            fuzziness: None,
        });
        assert_eq!(
            builder.to_elasticsearch_json()["query"],
            json!({ "fuzzy": { "name": { "value": "plastik" } } })
        );
    }

    #[test]
    fn test_bool_query_json_combines_must_should_must_not() {
        let builder = SearchQueryBuilder::new().bool_query(
            vec![QueryType::Term {
                field: SearchField::Status,
                value: json!("active"),
            }],
            vec![QueryType::Match {
                field: SearchField::Title,
                query: "urgent".to_string(),
            }],
            vec![QueryType::Term {
                field: SearchField::Archived,
                value: json!(true),
            }],
        );
        let body = builder.to_elasticsearch_json();
        assert!(body["query"]["bool"]["must"].is_array());
        assert!(body["query"]["bool"]["should"].is_array());
        assert!(body["query"]["bool"]["must_not"].is_array());
    }

    #[test]
    fn test_empty_bool_query_omits_empty_clauses() {
        let builder = SearchQueryBuilder::new().bool_query(vec![], vec![], vec![]);
        let body = builder.to_elasticsearch_json();
        assert_eq!(body["query"], json!({ "bool": {} }));
    }

    #[test]
    fn test_nested_bool_query() {
        let inner = QueryType::Bool {
            must: vec![QueryType::Term {
                field: SearchField::WasteType,
                value: json!("plastic"),
            }],
            should: vec![],
            must_not: vec![],
        };
        let builder = SearchQueryBuilder::new().bool_query(vec![inner], vec![], vec![]);
        let body = builder.to_elasticsearch_json();
        let must = body["query"]["bool"]["must"].as_array().unwrap();
        assert_eq!(must.len(), 1);
        assert!(must[0]["bool"]["must"].is_array());
    }

    // ── sorting ─────────────────────────────────────────────────────────

    #[test]
    fn test_single_sort_field() {
        let query =
            SearchQueryBuilder::new().sort(SearchField::CreatedAt, SortOrder::Desc).build();
        assert_eq!(
            query.sort,
            Some(vec![SortClause::new(SearchField::CreatedAt, SortOrder::Desc)])
        );
    }

    #[test]
    fn test_multiple_sort_fields_preserve_order() {
        let query = SearchQueryBuilder::new()
            .sort(SearchField::Priority, SortOrder::Desc)
            .sort(SearchField::CreatedAt, SortOrder::Asc)
            .build();
        let sort = query.sort.unwrap();
        assert_eq!(sort.len(), 2);
        assert_eq!(sort[0], SortClause::new(SearchField::Priority, SortOrder::Desc));
        assert_eq!(sort[1], SortClause::new(SearchField::CreatedAt, SortOrder::Asc));
    }

    #[test]
    fn test_no_sort_by_default() {
        let query = SearchQueryBuilder::new().build();
        assert!(query.sort.is_none());
    }

    #[test]
    fn test_sort_json_shape() {
        let body = SearchQueryBuilder::new()
            .sort(SearchField::CreatedAt, SortOrder::Desc)
            .to_elasticsearch_json();
        assert_eq!(
            body["sort"],
            json!([{ "created_at": { "order": "desc" } }])
        );
    }

    // ── pagination edges ─────────────────────────────────────────────────

    #[test]
    fn test_default_pagination() {
        let query = SearchQuery::default();
        assert_eq!(query.from, 0);
        assert_eq!(query.size, 20);
    }

    #[test]
    fn test_zero_size_page() {
        let query = SearchQueryBuilder::new().size(0).build();
        assert_eq!(query.size, 0);
    }

    #[test]
    fn test_large_offset_and_size() {
        let query = SearchQueryBuilder::new().from(1_000_000).size(10_000).build();
        assert_eq!(query.from, 1_000_000);
        assert_eq!(query.size, 10_000);
    }

    #[test]
    fn test_pagination_survives_other_builder_calls() {
        let query = SearchQueryBuilder::new()
            .from(5)
            .match_query(SearchField::Title, "waste")
            .size(15)
            .sort(SearchField::CreatedAt, SortOrder::Desc)
            .build();
        assert_eq!(query.from, 5);
        assert_eq!(query.size, 15);
    }

    // ── highlight / aggregation / source ─────────────────────────────────

    #[test]
    fn test_highlight_json_shape() {
        let builder = SearchQueryBuilder::new()
            .highlight(vec![SearchField::Title, SearchField::Body]);
        let body = builder.to_elasticsearch_json();
        assert_eq!(body["highlight"]["pre_tags"], json!(["<em>"]));
        assert_eq!(body["highlight"]["post_tags"], json!(["</em>"]));
        assert!(body["highlight"]["fields"]["title"].is_object());
        assert!(body["highlight"]["fields"]["body"].is_object());
    }

    #[test]
    fn test_aggregation_accumulates_multiple_names() {
        let builder = SearchQueryBuilder::new()
            .aggregation("by_status", json!({ "terms": { "field": "status" } }))
            .aggregation("by_category", json!({ "terms": { "field": "category" } }));
        let body = builder.to_elasticsearch_json();
        assert!(body["aggs"]["by_status"].is_object());
        assert!(body["aggs"]["by_category"].is_object());
    }

    #[test]
    fn test_source_field_filtering() {
        let query = SearchQueryBuilder::new()
            .source(vec![SearchField::Id, SearchField::Title])
            .build();
        assert_eq!(
            query.source,
            Some(vec![SearchField::Id, SearchField::Title])
        );
    }

    #[test]
    fn test_no_optional_fields_omitted_from_json_by_default() {
        let body = SearchQueryBuilder::new().to_elasticsearch_json();
        assert!(body.get("sort").is_none());
        assert!(body.get("highlight").is_none());
        assert!(body.get("aggs").is_none());
        assert!(body.get("_source").is_none());
    }

    // ── injection-safe parameter binding ─────────────────────────────────
    //
    // Values are bound as parameters (JSON leaves via `bind_value`), never
    // string-concatenated into the query body, so untrusted input can only
    // ever end up as a JSON string/number leaf. Field names are typed, so
    // they cannot inject either.

    #[test]
    fn test_match_query_treats_json_like_input_as_a_literal_string() {
        let malicious = r#"{"query": {"match_all": {}}}"#;
        let builder = SearchQueryBuilder::new().match_query(SearchField::Title, malicious);
        let body = builder.to_elasticsearch_json();
        assert_eq!(body["query"]["match"]["title"], json!(malicious));
        assert_eq!(body["query"].as_object().unwrap().len(), 1);
    }

    #[test]
    fn test_typed_field_names_cannot_inject_into_query_keys() {
        // With typed SearchField, an injection-style field name cannot be
        // constructed at all — from_name rejects it. The only field names
        // that reach the query are the known enum variants.
        assert_eq!(SearchField::from_name(r#"title"; DROP TABLE items; --"#), None);
        // A valid field renders as exactly one key.
        let body = SearchQueryBuilder::new().match_query(SearchField::Title, "value").build();
        match body.query {
            QueryType::Match { field, query } => {
                assert_eq!(field, SearchField::Title);
                assert_eq!(query, "value");
            }
            _ => panic!("Expected Match query"),
        }
    }

    #[test]
    fn test_term_query_preserves_non_string_value_types() {
        let builder = SearchQueryBuilder::new().term(SearchField::Count, json!(42));
        let body = builder.to_elasticsearch_json();
        assert_eq!(body["query"]["term"]["count"], json!(42));
        assert!(body["query"]["term"]["count"].is_number());
    }

    #[test]
    fn test_multi_match_query_with_quotes_and_braces_round_trips_verbatim() {
        let payload = r#"" OR 1=1 -- } { "malicious": true }"#;
        let builder = SearchQueryBuilder::new().multi_match(vec![SearchField::Title], payload);
        let body = builder.to_elasticsearch_json();
        assert_eq!(body["query"]["multi_match"]["query"], json!(payload));
    }

    #[test]
    fn test_wildcard_injection_attempt_stays_scoped_to_its_field() {
        let value = r#"*"}, "delete_all": {"match_all"#;
        let builder = SearchQueryBuilder::new().query(QueryType::Wildcard {
            field: SearchField::Name,
            value: value.to_string(),
        });
        let body = builder.to_elasticsearch_json();
        assert_eq!(body["query"], json!({ "wildcard": { "name": value } }));
        assert_eq!(body["query"].as_object().unwrap().keys().len(), 1);
    }

    #[test]
    fn test_bool_query_rejects_cross_clause_key_injection() {
        // A reserved bool-clause name ("should") is not a valid SearchField,
        // so it can never be used as a term field name to escape into a
        // sibling clause. Only typed fields reach the body.
        assert_eq!(SearchField::from_name("should"), None);
        let builder = SearchQueryBuilder::new().bool_query(
            vec![QueryType::Term {
                field: SearchField::Status,
                value: json!("hijack"),
            }],
            vec![],
            vec![],
        );
        let body = builder.to_elasticsearch_json();
        let must = body["query"]["bool"]["must"].as_array().unwrap();
        assert_eq!(must.len(), 1);
        assert_eq!(must[0], json!({ "term": { "status": "hijack" } }));
        assert!(body["query"]["bool"].get("should").is_none());
    }

    // ── parameter binding: unit tests ────────────────────────────────────

    #[test]
    fn parameterized_body_has_placeholders_not_values() {
        let pq = SearchQueryBuilder::new()
            .match_query(SearchField::Title, "recycling")
            .from(7)
            .size(25)
            .to_parameterized();
        // Three bound values: from, size, query.
        assert_eq!(pq.params.len(), 3);
        assert_eq!(pq.params[0], json!(7));
        assert_eq!(pq.params[1], json!(25));
        assert_eq!(pq.params[2], json!("recycling"));
        // The body references them positionally, not inline.
        assert_eq!(pq.body["from"], json!("$1"));
        assert_eq!(pq.body["size"], json!("$2"));
        assert_eq!(pq.body["query"]["match"]["title"], json!("$3"));
    }

    #[test]
    fn inline_json_has_no_placeholders() {
        let body = SearchQueryBuilder::new()
            .match_query(SearchField::Title, "$1")
            .to_elasticsearch_json();
        // The literal "$1" is a bound value, not a placeholder — it appears
        // inline and there are no other placeholders in the body.
        assert_eq!(body["query"]["match"]["title"], json!("$1"));
        assert_eq!(count_placeholders(&body), 0);
    }

    #[test]
    fn range_binds_one_parameter_per_present_bound() {
        let pq = SearchQueryBuilder::new()
            .query(QueryType::Range {
                field: SearchField::CreatedAt,
                gte: Some(json!("2024-01-01")),
                lte: None,
                gt: None,
                lt: Some(json!("2024-12-31")),
            })
            .to_parameterized();
        // from, size, gte, lt = 4 params.
        assert_eq!(pq.params.len(), 4);
        assert_eq!(pq.body["query"]["range"]["created_at"]["gte"], json!("$3"));
        assert_eq!(pq.body["query"]["range"]["created_at"]["lt"], json!("$4"));
    }

    #[test]
    fn aggregation_name_and_value_are_bound_together() {
        let pq = SearchQueryBuilder::new()
            .aggregation(
                "status'; DROP TABLE items; --",
                json!({"terms": {"field": "status"}}),
            )
            .to_parameterized();

        assert_eq!(pq.body["aggs"], json!("$3"));
        assert_eq!(
            pq.params[2],
            json!({"status'; DROP TABLE items; --": {"terms": {"field": "status"}}})
        );
    }

    // ── property tests: placeholder count matches parameter count ────────

    /// If a string looks like `"$N"` (N > 0, all digits), return Some(N).
    fn is_placeholder(s: &str) -> Option<usize> {
        if s.len() > 1 && s.starts_with('$') {
            s[1..].parse::<usize>().ok().filter(|n| *n >= 1)
        } else {
            None
        }
    }

    /// Count `$N` placeholder leaves in a JSON body.
    fn count_placeholders(body: &Value) -> usize {
        match body {
            Value::String(s) if is_placeholder(s).is_some() => 1,
            Value::Array(a) => a.iter().map(count_placeholders).sum(),
            Value::Object(m) => m.values().map(count_placeholders).sum(),
            _ => 0,
        }
    }

    /// Collect every `$N` placeholder number found in a JSON body.
    fn placeholder_numbers(body: &Value) -> Vec<usize> {
        let mut out = Vec::new();
        collect_placeholder_numbers(body, &mut out);
        out
    }

    fn collect_placeholder_numbers(body: &Value, out: &mut Vec<usize>) {
        match body {
            Value::String(s) => {
                if let Some(n) = is_placeholder(s) {
                    out.push(n);
                }
            }
            Value::Array(a) => a.iter().for_each(|v| collect_placeholder_numbers(v, out)),
            Value::Object(m) => m.values().for_each(|v| collect_placeholder_numbers(v, out)),
            _ => {}
        }
    }

    /// Substitute `$N` placeholders with `params[N-1]`, leaving everything else
    /// untouched. Used only to cross-check that the inline body equals the
    /// parameterized body with its params substituted back in.
    fn substitute_params(body: Value, params: &[Value]) -> Value {
        match body {
            Value::String(s) => match is_placeholder(&s) {
                Some(n) => {
                    let idx = n.saturating_sub(1);
                    params.get(idx).cloned().unwrap_or_else(|| Value::String(s))
                }
                None => Value::String(s),
            },
            Value::Array(a) => {
                Value::Array(a.into_iter().map(|v| substitute_params(v, params)).collect())
            }
            Value::Object(m) => {
                let mut out = Map::with_capacity(m.len());
                for (k, v) in m {
                    out.insert(k, substitute_params(v, params));
                }
                Value::Object(out)
            }
            other => other,
        }
    }

    fn arb_search_field() -> impl Strategy<Value = SearchField> {
        prop::sample::select(&[
            SearchField::Title,
            SearchField::Description,
            SearchField::Body,
            SearchField::Content,
            SearchField::Status,
            SearchField::WasteType,
            SearchField::Category,
            SearchField::Name,
            SearchField::Sku,
            SearchField::CreatedAt,
            SearchField::Score,
            SearchField::Id,
            SearchField::Priority,
            SearchField::Archived,
            SearchField::Weight,
            SearchField::Count,
            SearchField::Participant,
            SearchField::Tags,
        ])
    }

    /// Adversarial + arbitrary strings, including SQL/JSON-injection payloads
    /// and strings that look like placeholders.
    fn arb_text() -> impl Strategy<Value = String> {
        prop_oneof![
            any::<String>(),
            Just(r#"{"$or":[{}]}"#.to_string()),
            Just("$1 $2 $3".to_string()),
            Just("'; DROP TABLE items; --".to_string()),
            Just(r#"" OR 1=1 --"#.to_string()),
            Just(r#"*"},"x":{"y"#.to_string()),
        ]
    }

    fn arb_value() -> impl Strategy<Value = Value> {
        prop_oneof![
            any::<bool>().prop_map(Value::Bool),
            any::<i64>().prop_map(Value::from),
            Just(Value::Null),
            arb_text().prop_map(Value::String),
        ]
    }

    fn arb_query_type() -> impl Strategy<Value = QueryType> {
        let leaf = prop_oneof![
            Just(QueryType::MatchAll),
            (arb_search_field(), arb_text())
                .prop_map(|(f, q)| QueryType::Match { field: f, query: q }),
            (prop::collection::vec(arb_search_field(), 1..5), arb_text())
                .prop_map(|(fs, q)| QueryType::MultiMatch { fields: fs, query: q }),
            (arb_search_field(), arb_value())
                .prop_map(|(f, v)| QueryType::Term { field: f, value: v }),
            (
                arb_search_field(),
                prop::option::of(arb_value()),
                prop::option::of(arb_value()),
                prop::option::of(arb_value()),
                prop::option::of(arb_value())
            )
                .prop_map(|(f, gte, lte, gt, lt)| QueryType::Range { field: f, gte, lte, gt, lt }),
            (arb_search_field(), arb_text())
                .prop_map(|(f, v)| QueryType::Wildcard { field: f, value: v }),
            (arb_search_field(), arb_text())
                .prop_map(|(f, v)| QueryType::Prefix { field: f, value: v }),
            (arb_search_field(), arb_text(), prop::option::of(arb_text()))
                .prop_map(|(f, v, fz)| QueryType::Fuzzy { field: f, value: v, fuzziness: fz }),
        ];

        leaf.prop_recursive(3, 16, 4, |inner| {
            (
                prop::collection::vec(inner.clone(), 0..3),
                prop::collection::vec(inner.clone(), 0..3),
                prop::collection::vec(inner, 0..3),
            )
                .prop_map(|(must, should, must_not)| QueryType::Bool { must, should, must_not })
        })
    }

    proptest! {
        /// The number of `$N` placeholders in the parameterized body must
        /// always equal the number of bound parameters.
        #[test]
        fn prop_placeholder_count_matches_param_count(
            qt in arb_query_type(),
            from in 0usize..10_000,
            size in 0usize..100,
            aggregation_name in arb_text(),
            aggregation in arb_value(),
        ) {
            let pq = SearchQueryBuilder::new()
                .query(qt)
                .from(from)
                .size(size)
                .aggregation(aggregation_name, aggregation)
                .to_parameterized();
            let count = count_placeholders(&pq.body);
            prop_assert_eq!(count, pq.params.len());
        }

        /// Placeholder numbers must be exactly 1..=N with no gaps or
        /// duplicates, proving every bound value has a unique slot.
        #[test]
        fn prop_placeholders_are_unique_and_sequential(qt in arb_query_type()) {
            let pq = SearchQueryBuilder::new().query(qt).to_parameterized();
            let mut nums = placeholder_numbers(&pq.body);
            nums.sort_unstable();
            let expected: Vec<usize> = (1..=pq.params.len()).collect();
            prop_assert_eq!(nums, expected);
        }

        /// The inline Elasticsearch JSON must equal the parameterized body
        /// with its params substituted back in — the two paths share one
        /// rendering function, so they cannot diverge.
        #[test]
        fn prop_inline_matches_substituted_parameterized(
            qt in arb_query_type(),
            from in 0usize..10_000,
            size in 0usize..100,
            aggregation_name in arb_text(),
            aggregation in arb_value(),
        ) {
            let builder = SearchQueryBuilder::new()
                .query(qt)
                .from(from)
                .size(size)
                .aggregation(aggregation_name, aggregation);
            let pq = builder.to_parameterized();
            let inline = builder.to_elasticsearch_json();
            let substituted = substitute_params(pq.body, &pq.params);
            prop_assert_eq!(inline, substituted);
        }

        /// Arbitrary aggregation names and values stay in params, not the body.
        #[test]
        fn prop_aggregation_payload_is_parameterized(
            qt in arb_query_type(),
            from in 0usize..10_000,
            size in 0usize..100,
            aggregation_name in arb_text(),
            aggregation in arb_value(),
        ) {
            let mut expected_aggregations = Map::new();
            expected_aggregations.insert(aggregation_name.clone(), aggregation.clone());
            let pq = SearchQueryBuilder::new()
                .query(qt)
                .from(from)
                .size(size)
                .aggregation(aggregation_name, aggregation)
                .to_parameterized();

            let aggregation_slot = pq.body["aggs"].as_str().and_then(is_placeholder);
            prop_assert!(aggregation_slot.is_some());
            let parameter_index = aggregation_slot.unwrap() - 1;
            prop_assert_eq!(
                pq.params.get(parameter_index),
                Some(&Value::Object(expected_aggregations))
            );
        }
    }
}
