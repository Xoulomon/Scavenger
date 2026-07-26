//! Shared response serialization helpers.
//!
//! This module is the single source of truth for building API responses.
//! All handlers should use these helpers instead of constructing JSON
//! bodies inline.
//!
//! # Building responses
//!
//! ```rust,ignore
//! use crate::serializer::{ok, ok_paginated, created, no_content};
//!
//! // Single resource
//! return ok(my_item);
//!
//! // Paginated list
//! return ok_paginated(items, total, page, limit);
//!
//! // 201 Created
//! return created(new_resource);
//!
//! // 204 No Content
//! return no_content();
//! ```

use actix_web::HttpResponse;
use chrono::Utc;
use serde::{Deserialize, Serialize};

// ── Wire types ────────────────────────────────────────────────────────────────

/// Envelope wrapping every successful API response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: T,
    /// RFC-3339 timestamp at which the response was generated.
    pub timestamp: String,
}

/// Envelope wrapping a paginated list response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagedResponse<T> {
    pub success: bool,
    pub data: PagedData<T>,
    pub timestamp: String,
}

/// Payload of a paginated list response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagedData<T> {
    pub items: Vec<T>,
    pub pagination: PaginationMeta,
}

/// Pagination metadata included with every paginated response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationMeta {
    /// Total number of matching records (before pagination).
    pub total: u64,
    /// Current page number (1-based).
    pub page: u32,
    /// Maximum items per page.
    pub limit: u32,
    /// Total number of pages.
    pub total_pages: u32,
    /// Whether there is a next page.
    pub has_next: bool,
    /// Whether there is a previous page.
    pub has_prev: bool,
    /// Opaque cursor for the next page (`None` when on the last page).
    ///
    /// Handlers that support cursor-based pagination populate this field.
    /// Offset-based handlers leave it `None`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

impl PaginationMeta {
    /// Construct pagination metadata from offset-based params.
    pub fn from_offset(total: u64, page: u32, limit: u32) -> Self {
        let total_pages = if limit == 0 {
            0
        } else {
            ((total as u32).saturating_add(limit - 1)) / limit
        };
        PaginationMeta {
            total,
            page,
            limit,
            total_pages,
            has_next: page < total_pages,
            has_prev: page > 1,
            next_cursor: None,
        }
    }

    /// Construct pagination metadata with a cursor for the next page.
    pub fn with_cursor(total: u64, page: u32, limit: u32, next_cursor: Option<String>) -> Self {
        let mut meta = Self::from_offset(total, page, limit);
        meta.next_cursor = next_cursor;
        meta
    }
}

// ── Builder helpers ───────────────────────────────────────────────────────────

/// Return `200 OK` with a JSON-wrapped resource.
pub fn ok<T: Serialize>(data: T) -> HttpResponse {
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data,
        timestamp: Utc::now().to_rfc3339(),
    })
}

/// Return `201 Created` with a JSON-wrapped resource.
pub fn created<T: Serialize>(data: T) -> HttpResponse {
    HttpResponse::Created().json(ApiResponse {
        success: true,
        data,
        timestamp: Utc::now().to_rfc3339(),
    })
}

/// Return `204 No Content` (empty body).
pub fn no_content() -> HttpResponse {
    HttpResponse::NoContent().finish()
}

/// Return `200 OK` with a paginated list, offset-based.
pub fn ok_paginated<T: Serialize>(
    items: Vec<T>,
    total: u64,
    page: u32,
    limit: u32,
) -> HttpResponse {
    let pagination = PaginationMeta::from_offset(total, page, limit);
    HttpResponse::Ok().json(PagedResponse {
        success: true,
        data: PagedData { items, pagination },
        timestamp: Utc::now().to_rfc3339(),
    })
}

/// Return `200 OK` with a cursor-paginated list.
pub fn ok_cursor_paginated<T: Serialize>(
    items: Vec<T>,
    total: u64,
    page: u32,
    limit: u32,
    next_cursor: Option<String>,
) -> HttpResponse {
    let pagination = PaginationMeta::with_cursor(total, page, limit, next_cursor);
    HttpResponse::Ok().json(PagedResponse {
        success: true,
        data: PagedData { items, pagination },
        timestamp: Utc::now().to_rfc3339(),
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::body::to_bytes;

    async fn body_json(resp: HttpResponse) -> serde_json::Value {
        let bytes = to_bytes(resp.into_body()).await.unwrap();
        serde_json::from_slice(&bytes).unwrap()
    }

    #[actix_web::test]
    async fn test_ok_wraps_data() {
        let resp = ok(serde_json::json!({"id": "abc"}));
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
        let body = body_json(resp).await;
        assert_eq!(body["success"], true);
        assert_eq!(body["data"]["id"], "abc");
        assert!(body["timestamp"].is_string());
    }

    #[actix_web::test]
    async fn test_created_returns_201() {
        let resp = created(serde_json::json!({"id": "new"}));
        assert_eq!(resp.status(), actix_web::http::StatusCode::CREATED);
        let body = body_json(resp).await;
        assert_eq!(body["success"], true);
        assert_eq!(body["data"]["id"], "new");
    }

    #[actix_web::test]
    async fn test_no_content_returns_204() {
        let resp = no_content();
        assert_eq!(resp.status(), actix_web::http::StatusCode::NO_CONTENT);
    }

    #[actix_web::test]
    async fn test_ok_paginated_structure() {
        let items = vec!["a", "b", "c"];
        let resp = ok_paginated(items, 50, 2, 10);
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
        let body = body_json(resp).await;
        assert_eq!(body["success"], true);
        assert_eq!(body["data"]["items"].as_array().unwrap().len(), 3);
        let pg = &body["data"]["pagination"];
        assert_eq!(pg["total"], 50);
        assert_eq!(pg["page"], 2);
        assert_eq!(pg["limit"], 10);
        assert_eq!(pg["total_pages"], 5);
        assert_eq!(pg["has_next"], true);
        assert_eq!(pg["has_prev"], true);
    }

    #[actix_web::test]
    async fn test_ok_paginated_first_page() {
        let resp = ok_paginated(vec!["x"], 1, 1, 10);
        let body = body_json(resp).await;
        let pg = &body["data"]["pagination"];
        assert_eq!(pg["has_prev"], false);
        assert_eq!(pg["has_next"], false);
        assert_eq!(pg["total_pages"], 1);
    }

    #[actix_web::test]
    async fn test_ok_cursor_paginated_includes_cursor() {
        let resp = ok_cursor_paginated(
            vec!["item1"],
            100,
            1,
            10,
            Some("cursor_abc123".to_string()),
        );
        let body = body_json(resp).await;
        assert_eq!(body["data"]["pagination"]["next_cursor"], "cursor_abc123");
    }

    #[actix_web::test]
    async fn test_ok_cursor_paginated_no_cursor_when_none() {
        let resp = ok_cursor_paginated(vec!["item1"], 1, 1, 10, None);
        let body = body_json(resp).await;
        // next_cursor should be absent (skip_serializing_if = Option::is_none)
        assert!(body["data"]["pagination"]["next_cursor"].is_null());
    }

    #[test]
    fn test_pagination_meta_from_offset() {
        let meta = PaginationMeta::from_offset(100, 3, 10);
        assert_eq!(meta.total_pages, 10);
        assert!(meta.has_next);
        assert!(meta.has_prev);
        assert!(meta.next_cursor.is_none());
    }

    #[test]
    fn test_pagination_meta_last_page() {
        let meta = PaginationMeta::from_offset(25, 3, 10);
        assert_eq!(meta.total_pages, 3);
        assert!(!meta.has_next);
        assert!(meta.has_prev);
    }

    #[test]
    fn test_pagination_meta_single_page() {
        let meta = PaginationMeta::from_offset(5, 1, 10);
        assert_eq!(meta.total_pages, 1);
        assert!(!meta.has_next);
        assert!(!meta.has_prev);
    }

    #[test]
    fn test_pagination_meta_zero_total() {
        let meta = PaginationMeta::from_offset(0, 1, 10);
        assert_eq!(meta.total_pages, 0);
        assert!(!meta.has_next);
        assert!(!meta.has_prev);
    }

    #[test]
    fn test_pagination_meta_with_cursor() {
        let meta = PaginationMeta::with_cursor(50, 1, 10, Some("next_token".to_string()));
        assert_eq!(meta.next_cursor, Some("next_token".to_string()));
    }
}
