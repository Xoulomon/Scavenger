use crate::search::{build_search_query, format_search_response, SearchClient};
use actix_web::{web, HttpResponse, Result};
use elasticsearch::SearchParts;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

/// Search API handlers.
///
/// #1088: query-building (`crate::search::build_search_query`) and
/// result-formatting (`crate::search::format_search_response`) live in
/// `search/request.rs` and `search/response.rs` respectively, so both can be
/// unit tested without an HTTP request or a live Elasticsearch cluster. This
/// file is now just the glue: parse params, build the query, execute it,
/// format the response.
const SEARCHABLE_FIELDS: &[&str] = &["title", "description", "content"];

#[derive(Debug, Deserialize)]
pub struct SearchParams {
    pub q: String,
    #[serde(default)]
    pub from: usize,
    #[serde(default = "default_size")]
    pub size: usize,
    #[serde(default)]
    pub filters: Vec<String>,
}

fn default_size() -> usize {
    20
}

/// Perform a search query.
pub async fn search(client: web::Data<Arc<SearchClient>>, params: web::Query<SearchParams>) -> Result<HttpResponse> {
    let fields: Vec<String> = SEARCHABLE_FIELDS.iter().map(|f| f.to_string()).collect();
    let query_body = build_search_query(&params.q, params.from, params.size, &fields, &params.filters);

    let start = std::time::Instant::now();

    let es_response = client
        .client()
        .search(SearchParts::None)
        .body(query_body)
        .send()
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let es_body: serde_json::Value = es_response
        .json()
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let took_ms = start.elapsed().as_millis() as u64;
    let response = format_search_response(&es_body, took_ms);

    Ok(HttpResponse::Ok().json(response))
}

/// Get search suggestions/autocomplete
pub async fn suggest(
    _client: web::Data<Arc<SearchClient>>,
    _params: web::Query<SearchParams>,
) -> Result<HttpResponse> {
    let suggestions = vec!["waste type A", "waste type B", "participant name"];

    Ok(HttpResponse::Ok().json(json!({
        "suggestions": suggestions
    })))
}

/// Search configuration endpoint
pub async fn get_search_config() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "max_results": 10000,
        "default_page_size": 20,
        "max_page_size": 100,
        "available_filters": ["status", "type", "date_range", "participant"],
        "available_facets": ["status", "type", "created_date"],
        "searchable_fields": ["title", "description", "content", "tags"]
    })))
}
