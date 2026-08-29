//! #1088: query-building logic extracted from `api/search.rs` so it can be
//! unit tested in isolation from the HTTP handler and the Elasticsearch
//! client.

use super::query_builder::{QueryType, SearchQueryBuilder};
use serde_json::Value;

/// Parse a raw `field:value` filter string (as sent by API clients via the
/// `filters` query param) into a `(field, value)` pair. Malformed entries —
/// missing separator, empty field, or empty value — are dropped rather than
/// erroring, since they come from client-supplied query params and a bad
/// filter shouldn't fail the whole search.
pub fn parse_filter(raw: &str) -> Option<(String, String)> {
    let (field, value) = raw.split_once(':')?;
    let field = field.trim();
    let value = value.trim();
    if field.is_empty() || value.is_empty() {
        return None;
    }
    Some((field.to_string(), value.to_string()))
}

/// Build the Elasticsearch query body for a free-text search request.
///
/// Pure function: given the raw request parameters it returns the JSON body
/// to send to Elasticsearch, combining the free-text match across `fields`
/// with any valid `field:value` filters as `term` clauses in a bool query.
pub fn build_search_query(q: &str, from: usize, size: usize, fields: &[String], filters: &[String]) -> Value {
    let mut must: Vec<QueryType> = Vec::new();

    if !q.trim().is_empty() {
        must.push(QueryType::MultiMatch {
            fields: fields.to_vec(),
            query: q.to_string(),
        });
    }

    for (field, value) in filters.iter().filter_map(|f| parse_filter(f)) {
        must.push(QueryType::Term {
            field,
            value: Value::String(value),
        });
    }

    let query_type = match must.len() {
        0 => QueryType::MatchAll,
        1 => must.into_iter().next().unwrap(),
        _ => QueryType::Bool {
            must,
            should: Vec::new(),
            must_not: Vec::new(),
        },
    };

    SearchQueryBuilder::new()
        .query(query_type)
        .from(from)
        .size(size)
        .highlight(fields.to_vec())
        .to_elasticsearch_json()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_filter() {
        assert_eq!(
            parse_filter("status:active"),
            Some(("status".to_string(), "active".to_string()))
        );
    }

    #[test]
    fn trims_whitespace_around_filter_parts() {
        assert_eq!(
            parse_filter(" type : plastic "),
            Some(("type".to_string(), "plastic".to_string()))
        );
    }

    #[test]
    fn rejects_filter_without_separator() {
        assert_eq!(parse_filter("no-colon-here"), None);
    }

    #[test]
    fn rejects_filter_with_empty_field_or_value() {
        assert_eq!(parse_filter(":value"), None);
        assert_eq!(parse_filter("field:"), None);
        assert_eq!(parse_filter(""), None);
    }

    #[test]
    fn empty_query_and_no_filters_is_match_all() {
        let body = build_search_query("", 0, 20, &["title".to_string()], &[]);
        assert_eq!(body["query"], serde_json::json!({ "match_all": {} }));
    }

    #[test]
    fn query_only_produces_multi_match() {
        let fields = vec!["title".to_string(), "description".to_string()];
        let body = build_search_query("waste bin", 0, 20, &fields, &[]);
        assert_eq!(
            body["query"],
            serde_json::json!({
                "multi_match": { "query": "waste bin", "fields": fields }
            })
        );
    }

    #[test]
    fn query_with_filters_produces_bool_query() {
        let fields = vec!["title".to_string()];
        let filters = vec!["status:active".to_string()];
        let body = build_search_query("bin", 5, 10, &fields, &filters);
        assert_eq!(body["from"], 5);
        assert_eq!(body["size"], 10);
        let must = body["query"]["bool"]["must"].as_array().unwrap();
        assert_eq!(must.len(), 2);
    }

    #[test]
    fn invalid_filters_are_dropped_not_erroring() {
        let fields = vec!["title".to_string()];
        let filters = vec!["malformed".to_string(), "status:active".to_string()];
        let body = build_search_query("", 0, 20, &fields, &filters);
        // Only the valid filter survives, so this collapses to a single term query.
        assert_eq!(
            body["query"],
            serde_json::json!({ "term": { "status": "active" } })
        );
    }

    #[test]
    fn special_characters_in_query_are_preserved_verbatim() {
        let fields = vec!["title".to_string()];
        let body = build_search_query("50% \"reduce\" & reuse", 0, 20, &fields, &[]);
        assert_eq!(body["query"]["multi_match"]["query"], "50% \"reduce\" & reuse");
    }
}
