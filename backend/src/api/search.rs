use actix_web::{web, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::search::{SearchClient, SearchQueryBuilder, SearchRequest, SearchFilter, Facet};
use std::sync::Arc;

/// Search API handlers

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

#[derive(Debug, Serialize)]
pub struct SearchResponse<T> {
    pub total: u64,
    pub hits: Vec<T>,
    pub took_ms: u64,
    pub facets: Option<serde_json::Value>,
}

/// Perform a search query
pub async fn search(
    client: web::Data<Arc<SearchClient>>,
    params: web::Query<SearchParams>,
) -> Result<HttpResponse> {
    // Build the search query
    let query = SearchQueryBuilder::new()
        .multi_match(vec!["title".to_string(), "description".to_string(), "content".to_string()], &params.q)
        .from(params.from)
        .size(params.size)
        .highlight(vec!["title".to_string(), "description".to_string()])
        .build();

    // Execute search
    let start = std::time::Instant::now();

    // In a real implementation, you'd execute the query against Elasticsearch
    // For now, return a mock response
    let response = SearchResponse {
        total: 0,
        hits: Vec::<serde_json::Value>::new(),
        took_ms: start.elapsed().as_millis() as u64,
        facets: None,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// Get search suggestions/autocomplete
pub async fn suggest(
    client: web::Data<Arc<SearchClient>>,
    params: web::Query<SearchParams>,
) -> Result<HttpResponse> {
    let suggestions = vec![
        "waste type A",
        "waste type B",
        "participant name",
    ];

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
