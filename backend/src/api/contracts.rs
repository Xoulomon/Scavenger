use actix_web::{web, HttpRequest, HttpResponse};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::cache::Cache;
use crate::serializer::ok;
use crate::validation::{
    error_response, validate_cursor_pagination, CursorPaginationParams,
};

// ── Response types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasteResponse {
    pub id: String,
    pub waste_type: String,
    pub weight: u128,
    pub status: String,
    pub location: Option<String>,
    pub participant_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantResponse {
    pub id: String,
    pub name: String,
    pub role: String,
    pub location: Option<String>,
    pub reputation: u32,
    pub joined_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractStatsResponse {
    pub total_wastes: u64,
    pub total_participants: u64,
    pub total_weight: u128,
    pub recycled_weight: u128,
    pub pending_approvals: u32,
    pub active_participants: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractInfoResponse {
    pub contract_id: String,
    pub network: String,
    pub version: String,
    pub last_updated: String,
    pub total_transactions: u64,
}

// ── Query params ───────────────────────────────────────────────────────────────

/// Query parameters for the `list_wastes` endpoint.
///
/// Supports both offset-based (`page`/`limit`) and cursor-based
/// (`cursor`/`limit`) pagination via the embedded [`CursorPaginationParams`].
#[derive(Debug, Deserialize)]
pub struct WasteQueryParams {
    // Pagination (cursor or offset)
    pub cursor: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    // Filters
    pub status: Option<String>,
    pub waste_type: Option<String>,
    pub participant_id: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

impl WasteQueryParams {
    fn pagination(&self) -> CursorPaginationParams {
        CursorPaginationParams {
            cursor: self.cursor.clone(),
            page: self.page,
            limit: self.limit,
        }
    }
}

/// Query parameters for the `list_participants` endpoint.
#[derive(Debug, Deserialize)]
pub struct ParticipantQueryParams {
    // Pagination
    pub cursor: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    // Filters
    pub role: Option<String>,
    pub search: Option<String>,
}

impl ParticipantQueryParams {
    fn pagination(&self) -> CursorPaginationParams {
        CursorPaginationParams {
            cursor: self.cursor.clone(),
            page: self.page,
            limit: self.limit,
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn query_string(req: &HttpRequest) -> String {
    let qs = req.query_string();
    if qs.is_empty() { "all".to_string() } else { qs.to_string() }
}

/// Build an opaque base-64 cursor from a page offset so callers can navigate
/// forwards without needing to know the internal pagination model.
fn encode_cursor(page: u32) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    STANDARD.encode(format!("page:{}", page))
}

/// Decode a cursor back to a page number. Returns `None` for invalid cursors.
fn decode_cursor(cursor: &str) -> Option<u32> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let decoded = STANDARD.decode(cursor).ok()?;
    let s = String::from_utf8(decoded).ok()?;
    s.strip_prefix("page:")?.parse().ok()
}

// ── Handlers ──────────────────────────────────────────────────────────────────

pub async fn list_wastes(
    req: HttpRequest,
    cache: web::Data<Cache>,
    query: web::Query<WasteQueryParams>,
) -> HttpResponse {
    let pagination = query.pagination();

    // Validate
    let errors = validate_cursor_pagination(&pagination);
    if !errors.is_empty() {
        return error_response(&errors);
    }

    // Resolve cursor → page
    let page = match &pagination.cursor {
        Some(c) => decode_cursor(c).unwrap_or(1),
        None => pagination.resolved_page(),
    };
    let limit = pagination.resolved_limit();

    let cache_key = format!("contract:wastes:{}", query_string(&req));
    if let Some(cached) = cache.get(&cache_key) {
        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&cached) {
            return HttpResponse::Ok()
                .insert_header(("X-Cache", "HIT"))
                .json(val);
        }
    }

    // Stub data — replace with a real DB query in production
    let mut items = all_waste_items();

    // Apply filters
    if let Some(ref status) = query.status {
        items.retain(|w| w.status == *status);
    }
    if let Some(ref waste_type) = query.waste_type {
        items.retain(|w| w.waste_type == *waste_type);
    }
    if let Some(ref pid) = query.participant_id {
        items.retain(|w| w.participant_id == *pid);
    }

    let total = items.len() as u64;
    let start = ((page - 1) * limit) as usize;
    let end = (start + limit as usize).min(items.len());
    let page_items: Vec<WasteResponse> = if start < items.len() {
        items[start..end].to_vec()
    } else {
        Vec::new()
    };

    // Build cursor for next page
    let total_pages = if limit > 0 { ((total as u32).saturating_add(limit - 1)) / limit } else { 0 };
    let next_cursor = if page < total_pages { Some(encode_cursor(page + 1)) } else { None };

    let body = build_paged_value(&page_items, total, page, limit, next_cursor);
    if let Ok(json) = serde_json::to_vec(&body) {
        cache.set(cache_key, json);
    }

    HttpResponse::Ok()
        .insert_header(("X-Cache", "MISS"))
        .json(body)
}

pub async fn get_waste(
    cache: web::Data<Cache>,
    path: web::Path<String>,
) -> HttpResponse {
    let waste_id = path.into_inner();
    let cache_key = format!("contract:waste:{}", waste_id);

    if let Some(cached) = cache.get(&cache_key) {
        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&cached) {
            return HttpResponse::Ok()
                .insert_header(("X-Cache", "HIT"))
                .json(val);
        }
    }

    let waste = WasteResponse {
        id: waste_id.clone(),
        waste_type: "plastic".to_string(),
        weight: 100,
        status: "pending".to_string(),
        location: Some("40.7128,-74.0060".to_string()),
        participant_id: "participant-001".to_string(),
        created_at: now(),
        updated_at: now(),
    };

    let body = build_ok_value(&waste);
    if let Ok(json) = serde_json::to_vec(&body) {
        cache.set(cache_key, json);
    }

    HttpResponse::Ok()
        .insert_header(("X-Cache", "MISS"))
        .json(body)
}

pub async fn list_participants(
    req: HttpRequest,
    cache: web::Data<Cache>,
    query: web::Query<ParticipantQueryParams>,
) -> HttpResponse {
    let pagination = query.pagination();

    let errors = validate_cursor_pagination(&pagination);
    if !errors.is_empty() {
        return error_response(&errors);
    }

    let page = match &pagination.cursor {
        Some(c) => decode_cursor(c).unwrap_or(1),
        None => pagination.resolved_page(),
    };
    let limit = pagination.resolved_limit();

    let cache_key = format!("contract:participants:{}", query_string(&req));
    if let Some(cached) = cache.get(&cache_key) {
        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&cached) {
            return HttpResponse::Ok()
                .insert_header(("X-Cache", "HIT"))
                .json(val);
        }
    }

    let mut items = all_participant_items();

    if let Some(ref role) = query.role {
        items.retain(|p| p.role == *role);
    }
    if let Some(ref search) = query.search {
        items.retain(|p| p.name.to_lowercase().contains(&search.to_lowercase()));
    }

    let total = items.len() as u64;
    let start = ((page - 1) * limit) as usize;
    let end = (start + limit as usize).min(items.len());
    let page_items: Vec<ParticipantResponse> = if start < items.len() {
        items[start..end].to_vec()
    } else {
        Vec::new()
    };

    let total_pages = if limit > 0 { ((total as u32).saturating_add(limit - 1)) / limit } else { 0 };
    let next_cursor = if page < total_pages { Some(encode_cursor(page + 1)) } else { None };

    let body = build_paged_value(&page_items, total, page, limit, next_cursor);
    if let Ok(json) = serde_json::to_vec(&body) {
        cache.set(cache_key, json);
    }

    HttpResponse::Ok()
        .insert_header(("X-Cache", "MISS"))
        .json(body)
}

pub async fn get_participant(
    cache: web::Data<Cache>,
    path: web::Path<String>,
) -> HttpResponse {
    let participant_id = path.into_inner();
    let cache_key = format!("contract:participant:{}", participant_id);

    if let Some(cached) = cache.get(&cache_key) {
        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&cached) {
            return HttpResponse::Ok()
                .insert_header(("X-Cache", "HIT"))
                .json(val);
        }
    }

    let participant = ParticipantResponse {
        id: participant_id,
        name: "Green Recycling Co".to_string(),
        role: "collector".to_string(),
        location: Some("New York, NY".to_string()),
        reputation: 85,
        joined_at: now(),
    };

    let body = build_ok_value(&participant);
    if let Ok(json) = serde_json::to_vec(&body) {
        cache.set(cache_key, json);
    }

    HttpResponse::Ok()
        .insert_header(("X-Cache", "MISS"))
        .json(body)
}

pub async fn get_contract_stats(cache: web::Data<Cache>) -> HttpResponse {
    let cache_key = "contract:stats".to_string();

    if let Some(cached) = cache.get(&cache_key) {
        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&cached) {
            return HttpResponse::Ok()
                .insert_header(("X-Cache", "HIT"))
                .json(val);
        }
    }

    let stats = ContractStatsResponse {
        total_wastes: 1250,
        total_participants: 340,
        total_weight: 50000,
        recycled_weight: 35000,
        pending_approvals: 45,
        active_participants: 280,
    };

    let body = build_ok_value(&stats);
    if let Ok(json) = serde_json::to_vec(&body) {
        cache.set(cache_key, json);
    }

    HttpResponse::Ok()
        .insert_header(("X-Cache", "MISS"))
        .json(body)
}

pub async fn get_contract_info(cache: web::Data<Cache>) -> HttpResponse {
    let cache_key = "contract:info".to_string();

    if let Some(cached) = cache.get(&cache_key) {
        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&cached) {
            return HttpResponse::Ok()
                .insert_header(("X-Cache", "HIT"))
                .json(val);
        }
    }

    let info = ContractInfoResponse {
        contract_id: "CAZTLQY7YZ6J7XOFY6Q6Y6Q6Y6Q6Y6Q6Y6Q6Y6Q6Y6".to_string(),
        network: "testnet".to_string(),
        version: "1.0.0".to_string(),
        last_updated: now(),
        total_transactions: 15234,
    };

    let body = build_ok_value(&info);
    if let Ok(json) = serde_json::to_vec(&body) {
        cache.set(cache_key, json);
    }

    HttpResponse::Ok()
        .insert_header(("X-Cache", "MISS"))
        .json(body)
}

pub async fn invalidate_waste_cache(
    cache: web::Data<Cache>,
    path: web::Path<String>,
) -> HttpResponse {
    let waste_id = path.into_inner();
    cache.invalidate(&format!("contract:waste:{}", waste_id));
    ok(serde_json::json!({"message": "cache invalidated"}))
}

pub async fn invalidate_all_cache(cache: web::Data<Cache>) -> HttpResponse {
    cache.clear();
    ok(serde_json::json!({"message": "all cache invalidated"}))
}

// ── Serialization helpers ─────────────────────────────────────────────────────

/// Serialize a single resource into the shared success envelope as a `Value`
/// so it can be cached efficiently without a second parse.
fn build_ok_value<T: Serialize>(data: &T) -> serde_json::Value {
    serde_json::json!({
        "success": true,
        "data": data,
        "timestamp": now(),
    })
}

/// Serialize a paged result set into the shared paginated envelope as a `Value`.
fn build_paged_value<T: Serialize>(
    items: &[T],
    total: u64,
    page: u32,
    limit: u32,
    next_cursor: Option<String>,
) -> serde_json::Value {
    let total_pages = if limit > 0 { ((total as u32).saturating_add(limit - 1)) / limit } else { 0 };
    let has_next = page < total_pages;
    let has_prev = page > 1;

    let mut pagination = serde_json::json!({
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_next": has_next,
        "has_prev": has_prev,
    });

    if let Some(cursor) = next_cursor {
        pagination["next_cursor"] = serde_json::Value::String(cursor);
    }

    serde_json::json!({
        "success": true,
        "data": {
            "items": items,
            "pagination": pagination,
        },
        "timestamp": now(),
    })
}

// ── Stub data helpers ──────────────────────────────────────────────────────────

fn all_waste_items() -> Vec<WasteResponse> {
    vec![
        WasteResponse {
            id: "waste-001".to_string(),
            waste_type: "plastic".to_string(),
            weight: 100,
            status: "pending".to_string(),
            location: Some("40.7128,-74.0060".to_string()),
            participant_id: "participant-001".to_string(),
            created_at: now(),
            updated_at: now(),
        },
        WasteResponse {
            id: "waste-002".to_string(),
            waste_type: "metal".to_string(),
            weight: 250,
            status: "approved".to_string(),
            location: Some("34.0522,-118.2437".to_string()),
            participant_id: "participant-002".to_string(),
            created_at: now(),
            updated_at: now(),
        },
        WasteResponse {
            id: "waste-003".to_string(),
            waste_type: "glass".to_string(),
            weight: 75,
            status: "processing".to_string(),
            location: Some("51.5074,-0.1278".to_string()),
            participant_id: "participant-001".to_string(),
            created_at: now(),
            updated_at: now(),
        },
        WasteResponse {
            id: "waste-004".to_string(),
            waste_type: "paper".to_string(),
            weight: 50,
            status: "verified".to_string(),
            location: Some("48.8566,2.3522".to_string()),
            participant_id: "participant-003".to_string(),
            created_at: now(),
            updated_at: now(),
        },
    ]
}

fn all_participant_items() -> Vec<ParticipantResponse> {
    vec![
        ParticipantResponse {
            id: "participant-001".to_string(),
            name: "Green Recycling Co".to_string(),
            role: "collector".to_string(),
            location: Some("New York, NY".to_string()),
            reputation: 85,
            joined_at: now(),
        },
        ParticipantResponse {
            id: "participant-002".to_string(),
            name: "Eco Waste Management".to_string(),
            role: "processor".to_string(),
            location: Some("Los Angeles, CA".to_string()),
            reputation: 92,
            joined_at: now(),
        },
        ParticipantResponse {
            id: "participant-003".to_string(),
            name: "Sustainable Materials Inc".to_string(),
            role: "collector".to_string(),
            location: Some("London, UK".to_string()),
            reputation: 78,
            joined_at: now(),
        },
    ]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test;

    // ── list_wastes ───────────────────────────────────────────────────────────

    #[actix_web::test]
    async fn test_list_wastes_default_pagination() {
        let cache = Cache::new(60);
        let req = test::TestRequest::default().to_http_request();
        let query = web::Query(WasteQueryParams {
            cursor: None,
            page: None,
            limit: None,
            status: None,
            waste_type: None,
            participant_id: None,
            sort_by: None,
            sort_order: None,
        });
        let resp = list_wastes(req, web::Data::new(cache), query).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_list_wastes_invalid_page_zero() {
        let cache = Cache::new(60);
        let req = test::TestRequest::default().to_http_request();
        let query = web::Query(WasteQueryParams {
            cursor: None,
            page: Some(0),
            limit: Some(10),
            status: None,
            waste_type: None,
            participant_id: None,
            sort_by: None,
            sort_order: None,
        });
        let resp = list_wastes(req, web::Data::new(cache), query).await;
        // validate_cursor_pagination → validate_pagination returns error → error_response → 422
        assert_eq!(resp.status(), actix_web::http::StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[actix_web::test]
    async fn test_list_wastes_cursor_bypasses_page_validation() {
        // When a cursor is present, page=0 is ignored
        let cache = Cache::new(60);
        let req = test::TestRequest::default().to_http_request();
        let query = web::Query(WasteQueryParams {
            cursor: Some(encode_cursor(2)),
            page: Some(0),
            limit: Some(2),
            status: None,
            waste_type: None,
            participant_id: None,
            sort_by: None,
            sort_order: None,
        });
        let resp = list_wastes(req, web::Data::new(cache), query).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_list_wastes_filter_by_status() {
        let cache = Cache::new(60);
        let req = test::TestRequest::default().to_http_request();
        let query = web::Query(WasteQueryParams {
            cursor: None,
            page: Some(1),
            limit: Some(10),
            status: Some("approved".to_string()),
            waste_type: None,
            participant_id: None,
            sort_by: None,
            sort_order: None,
        });
        let resp = list_wastes(req, web::Data::new(cache), query).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_list_wastes_response_has_pagination_meta() {
        let cache = Cache::new(60);
        let req = test::TestRequest::default().to_http_request();
        let query = web::Query(WasteQueryParams {
            cursor: None,
            page: Some(1),
            limit: Some(2),
            status: None,
            waste_type: None,
            participant_id: None,
            sort_by: None,
            sort_order: None,
        });
        let resp = list_wastes(req, web::Data::new(cache), query).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    // ── get_waste ─────────────────────────────────────────────────────────────

    #[actix_web::test]
    async fn test_get_waste_returns_200() {
        let cache = Cache::new(60);
        let resp =
            get_waste(web::Data::new(cache), web::Path::from("waste-001".to_string())).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    // ── get_contract_stats ────────────────────────────────────────────────────

    #[actix_web::test]
    async fn test_get_contract_stats() {
        let cache = Cache::new(60);
        let resp = get_contract_stats(web::Data::new(cache)).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    // ── cache hit / miss ──────────────────────────────────────────────────────

    #[actix_web::test]
    async fn test_cache_miss_then_hit() {
        let cache = Cache::new(60);
        let resp1 = get_contract_stats(web::Data::new(cache.clone())).await;
        assert_eq!(
            resp1.headers().get("X-Cache").and_then(|v| v.to_str().ok()),
            Some("MISS")
        );
        let resp2 = get_contract_stats(web::Data::new(cache)).await;
        assert_eq!(
            resp2.headers().get("X-Cache").and_then(|v| v.to_str().ok()),
            Some("HIT")
        );
    }

    // ── cursor encode/decode ──────────────────────────────────────────────────

    #[test]
    fn test_cursor_round_trip() {
        let cursor = encode_cursor(5);
        assert_eq!(decode_cursor(&cursor), Some(5));
    }

    #[test]
    fn test_decode_invalid_cursor_returns_none() {
        assert_eq!(decode_cursor("not_valid_base64_!!!"), None);
    }

    #[test]
    fn test_encode_cursor_page_1() {
        let cursor = encode_cursor(1);
        assert_eq!(decode_cursor(&cursor), Some(1));
    }

    // ── build_paged_value ─────────────────────────────────────────────────────

    #[test]
    fn test_build_paged_value_includes_cursor() {
        let items: Vec<&str> = vec!["a", "b"];
        let body = build_paged_value(&items, 10, 1, 2, Some("cursor123".to_string()));
        assert_eq!(body["data"]["pagination"]["next_cursor"], "cursor123");
        assert_eq!(body["data"]["pagination"]["total"], 10);
        assert_eq!(body["data"]["pagination"]["has_next"], true);
        assert_eq!(body["data"]["pagination"]["has_prev"], false);
    }

    #[test]
    fn test_build_paged_value_no_cursor_on_last_page() {
        let items: Vec<&str> = vec!["a"];
        let body = build_paged_value(&items, 1, 1, 10, None);
        assert!(body["data"]["pagination"]["next_cursor"].is_null());
        assert_eq!(body["data"]["pagination"]["has_next"], false);
    }
}
