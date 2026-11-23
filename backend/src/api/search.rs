use crate::search::service::{SearchService, SearchServiceError};
use actix_web::{web, HttpResponse, Result};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

/// Search API handlers (controller layer).
///
/// #1697: this module is now a thin controller. It parses/validates request
/// parameters and shapes HTTP responses; all business logic lives in
/// `crate::search::service::SearchService` and data access in
/// `crate::search::repository::SearchRepository`. Route paths, response
/// schemas and error codes are unchanged.
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

/// Map a service error onto the HTTP error code used previously.
fn map_service_error(err: SearchServiceError) -> actix_web::Error {
    match err {
        SearchServiceError::Backend(_) => actix_web::error::ErrorInternalServerError(err),
    }
}

/// Perform a search query.
pub async fn search(service: web::Data<Arc<SearchService>>, params: web::Query<SearchParams>) -> Result<HttpResponse> {
    let fields: Vec<String> = SEARCHABLE_FIELDS.iter().map(|f| f.to_string()).collect();

    let response = service
        .search(&params.q, params.from, params.size, &fields, &params.filters)
        .await
        .map_err(map_service_error)?;

    Ok(HttpResponse::Ok().json(response))
}

/// Get search suggestions/autocomplete
pub async fn suggest(
    service: web::Data<Arc<SearchService>>,
    _params: web::Query<SearchParams>,
) -> Result<HttpResponse> {
    let suggestions = service.suggest();

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "suggestions": suggestions
    })))
}

/// Search configuration endpoint
pub async fn get_search_config() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "max_results": 10000,
        "default_page_size": super::pagination::PaginationParams::DEFAULT_LIMIT,
        "max_page_size": super::pagination::PaginationParams::MAX_LIMIT,
        "available_filters": ["status", "type", "date_range", "participant"],
        "available_facets": ["status", "type", "created_date"],
        "searchable_fields": ["title", "description", "content", "tags"]
    })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::search::service::SearchService;
    use crate::search::SearchClient;
    use actix_web::{test, App};
    use std::sync::Arc;

    fn test_client() -> Arc<SearchClient> {
        Arc::new(SearchClient::new("http://localhost:9200").expect("client"))
    }

    #[actix_web::test]
    async fn suggest_returns_suggestions() {
        let service = Arc::new(SearchService::new(test_client()));
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(service))
                .route("/search/suggest", web::get().to(suggest)),
        )
        .await;

        let req = test::TestRequest::get().uri("/search/suggest?q=waste").to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());

        let body: serde_json::Value = test::read_body_json(resp).await;
        assert!(body["suggestions"].is_array());
    }

    #[actix_web::test]
    async fn config_returns_expected_shape() {
        let app = test::init_service(App::new().route("/search/config", web::get().to(get_search_config))).await;

        let req = test::TestRequest::get().uri("/search/config").to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());

        let body: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(body["default_page_size"], 20);
        assert_eq!(body["max_page_size"], 100);
    }
}
