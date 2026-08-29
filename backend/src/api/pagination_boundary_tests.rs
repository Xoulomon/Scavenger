//! Pagination & boundary tests — closes #959.
//!
//! Tests every edge of the paginated API:
//! - Empty collection (no items)
//! - Exactly one page of results
//! - Last (partial) page
//! - Oversize page request (limit > max allowed)
//! - Offset past end of collection
//! - Zero limit (rejected)
//! - Zero page (rejected)
//! - Max-size enforcement (limit = 100, limit = 101)
//! - `total_pages` ceiling-division correctness
//! - Fixture-driven: a fixed slice of 25 items used for all slice tests

#[cfg(test)]
mod tests {
    use crate::{
        api::pagination::{paginate, paginate_from_cursor},
        services::api::ApiBuilder,
        validation::validate_pagination,
    };

    // ── Fixtures ──────────────────────────────────────────────────────────────

    /// Build a Vec of `n` simple string items used as pagination fixtures.
    fn fixture_items(n: usize) -> Vec<String> {
        (1..=n).map(|i| format!("item-{:03}", i)).collect()
    }

    // ── Empty collection ──────────────────────────────────────────────────────

    #[test]
    fn test_empty_collection_returns_empty_page() {
        let items: Vec<String> = vec![];
        let page = paginate(&items, 1, 10);
        assert_eq!(page.items.len(), 0);
        assert_eq!(page.total, 0);
        assert_eq!(page.total_pages, 0);
        assert_eq!(page.page, 1);
        assert_eq!(page.limit, 10);
    }

    #[test]
    fn test_empty_collection_page_2_also_empty() {
        let items: Vec<String> = vec![];
        let page = paginate(&items, 2, 10);
        assert_eq!(page.items.len(), 0);
        assert_eq!(page.total_pages, 0);
    }

    // ── Exactly one full page ─────────────────────────────────────────────────

    #[test]
    fn test_single_full_page() {
        let items = fixture_items(10);
        let page = paginate(&items, 1, 10);
        assert_eq!(page.items.len(), 10);
        assert_eq!(page.total_pages, 1);
        assert_eq!(page.items[0], "item-001");
        assert_eq!(page.items[9], "item-010");
        assert!(!page.has_more);
        assert!(page.next_cursor.is_none());
    }

    // ── First and second page from 25-item fixture ────────────────────────────

    #[test]
    fn test_first_page_of_25_items() {
        let items = fixture_items(25);
        let page = paginate(&items, 1, 10);
        assert_eq!(page.items.len(), 10);
        assert_eq!(page.total, 25);
        assert_eq!(page.total_pages, 3);
        assert_eq!(page.items[0], "item-001");
        assert_eq!(page.items[9], "item-010");
        assert!(page.has_more);
        assert_eq!(page.next_cursor.as_deref(), Some("10"));
    }

    #[test]
    fn test_second_page_of_25_items() {
        let items = fixture_items(25);
        let page = paginate(&items, 2, 10);
        assert_eq!(page.items.len(), 10);
        assert_eq!(page.items[0], "item-011");
        assert_eq!(page.items[9], "item-020");
    }

    // ── Last (partial) page ───────────────────────────────────────────────────

    #[test]
    fn test_last_partial_page() {
        let items = fixture_items(25);
        let page = paginate(&items, 3, 10);
        // 25 items, limit 10 → last page has 5 items
        assert_eq!(page.items.len(), 5);
        assert_eq!(page.items[0], "item-021");
        assert_eq!(page.items[4], "item-025");
        assert_eq!(page.total_pages, 3);
    }

    #[test]
    fn test_last_page_exact_boundary() {
        // 20 items, limit 10 → page 2 is exactly full
        let items = fixture_items(20);
        let page = paginate(&items, 2, 10);
        assert_eq!(page.items.len(), 10);
        assert_eq!(page.total_pages, 2);
        assert_eq!(page.items[9], "item-020");
    }

    // ── Offset past end of collection ─────────────────────────────────────────

    #[test]
    fn test_page_beyond_last_returns_empty() {
        let items = fixture_items(10);
        let page = paginate(&items, 5, 10);
        assert_eq!(page.items.len(), 0, "page past end should be empty");
        assert_eq!(page.total, 10);
        assert_eq!(page.total_pages, 1);
    }

    // ── total_pages ceiling-division ──────────────────────────────────────────

    #[test]
    fn test_total_pages_ceiling_division() {
        // 11 items, limit 5 → ceil(11/5) = 3 pages
        let r = ApiBuilder::paginated_response(vec![0u32; 5], 11, 1, 5);
        assert_eq!(r.total_pages, 3);

        // Exact division: 10 items, limit 5 → 2 pages
        let r = ApiBuilder::paginated_response(vec![0u32; 5], 10, 1, 5);
        assert_eq!(r.total_pages, 2);

        // 1 item, limit 100 → 1 page
        let r = ApiBuilder::paginated_response(vec![0u32; 1], 1, 1, 100);
        assert_eq!(r.total_pages, 1);
    }

    #[test]
    fn test_total_pages_zero_limit_safe() {
        // Limit=0 must not panic (division-by-zero guard)
        let r = ApiBuilder::paginated_response(Vec::<u32>::new(), 0, 1, 0);
        assert_eq!(r.total_pages, 0);
    }

    // ── validate_pagination: max-size enforcement ─────────────────────────────

    #[test]
    fn test_max_size_exactly_100_is_valid() {
        let errs = validate_pagination(1, 100);
        assert!(errs.is_empty(), "limit=100 should be accepted");
    }

    #[test]
    fn test_max_size_101_is_rejected() {
        let errs = validate_pagination(1, 101);
        assert!(!errs.is_empty(), "limit=101 should be rejected");
        assert!(errs.iter().any(|e| e.field == "limit"));
    }

    #[test]
    fn test_zero_limit_is_rejected() {
        let errs = validate_pagination(1, 0);
        assert!(!errs.is_empty());
        assert!(errs.iter().any(|e| e.field == "limit"));
    }

    #[test]
    fn test_zero_page_is_rejected() {
        let errs = validate_pagination(0, 10);
        assert!(!errs.is_empty());
        assert!(errs.iter().any(|e| e.field == "page"));
    }

    #[test]
    fn test_both_invalid_returns_two_errors() {
        let errs = validate_pagination(0, 0);
        assert_eq!(errs.len(), 2, "both page and limit invalid should produce 2 errors");
    }

    #[test]
    fn test_boundary_page_1_limit_1_valid() {
        let errs = validate_pagination(1, 1);
        assert!(errs.is_empty());
    }

    #[test]
    fn test_large_page_number_valid() {
        // Validation does not cap page number — only limit is bounded
        let errs = validate_pagination(99999, 50);
        assert!(errs.is_empty());
    }

    // ── Single-item collection ────────────────────────────────────────────────

    #[test]
    fn test_single_item_collection() {
        let items = fixture_items(1);
        let page = paginate(&items, 1, 10);
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.total, 1);
        assert_eq!(page.total_pages, 1);
    }

    // ── limit equals total ────────────────────────────────────────────────────

    #[test]
    fn test_limit_equals_total() {
        let items = fixture_items(7);
        let page = paginate(&items, 1, 7);
        assert_eq!(page.items.len(), 7);
        assert_eq!(page.total_pages, 1);
    }

    // ── limit larger than total ───────────────────────────────────────────────

    #[test]
    fn test_oversize_limit_returns_all_items() {
        let items = fixture_items(5);
        // Requesting page 1 with limit=100 on 5 items → all 5 returned
        let page = paginate(&items, 1, 100);
        assert_eq!(page.items.len(), 5);
        assert_eq!(page.total, 5);
        assert_eq!(page.total_pages, 1);
    }

    // ── page metadata is always present ──────────────────────────────────────

    #[test]
    fn test_response_metadata_always_populated() {
        let page = ApiBuilder::paginated_response(vec!["a", "b"], 50, 3, 10);
        assert_eq!(page.page, 3);
        assert_eq!(page.limit, 10);
        assert_eq!(page.total, 50);
        assert_eq!(page.total_pages, 5);
    }

    #[test]
    fn test_cursor_pagination_preserves_total_and_advances_cursor() {
        let items = fixture_items(25);
        let page = paginate_from_cursor(&items, Some(10), 10);
        assert_eq!(page.items[0], "item-011");
        assert_eq!(page.total, 25);
        assert!(page.has_more);
        assert_eq!(page.next_cursor.as_deref(), Some("20"));
    }
}
