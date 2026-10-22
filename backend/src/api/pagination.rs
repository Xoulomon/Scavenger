use crate::services::api::PaginatedResponse;
use crate::validation::validate_pagination;

/// Shared `page`/`limit` extractor for handlers that accept optional
/// pagination query params.
///
/// Centralizes the `unwrap_or` defaults + `validate_pagination` call that
/// was previously duplicated across handlers in `contracts.rs`,
/// `verification.rs`, and others. Construct via [`PaginationParams::resolve`]
/// directly from the `Option<u32>` fields of a handler's query struct.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PaginationParams {
    pub page: u32,
    pub limit: u32,
}

impl PaginationParams {
    /// Default page size used when a handler's query omits `limit`.
    pub const DEFAULT_LIMIT: u32 = 20;
    /// Default page used when a handler's query omits `page`.
    pub const DEFAULT_PAGE: u32 = 1;

    /// Resolve raw `Option<u32>` query params into a validated
    /// `PaginationParams`, or return the list of validation error messages
    /// produced by [`validate_pagination`].
    ///
    /// Edge cases handled by `validate_pagination` (zero limit, zero page,
    /// over-max limit) surface here as `Err(errors)` so handlers can return
    /// a 400 without re-implementing the check.
    pub fn resolve(page: Option<u32>, limit: Option<u32>) -> Result<Self, Vec<String>> {
        let page = page.unwrap_or(Self::DEFAULT_PAGE);
        let limit = limit.unwrap_or(Self::DEFAULT_LIMIT);

        let errors = validate_pagination(page, limit);
        if !errors.is_empty() {
            return Err(errors);
        }

        Ok(Self { page, limit })
    }

    /// Apply this pagination to a slice, producing the canonical envelope.
    pub fn paginate<T: Clone>(&self, items: &[T]) -> PaginatedResponse<T> {
        paginate(items, self.page, self.limit)
    }
}

/// Apply offset pagination and build the canonical pagination payload.
pub fn paginate<T: Clone>(items: &[T], page: u32, limit: u32) -> PaginatedResponse<T> {
    let start = page.saturating_sub(1).saturating_mul(limit);
    paginate_from_offset(items, start, page, limit)
}

pub fn paginate_from_cursor<T: Clone>(items: &[T], cursor: Option<u32>, limit: u32) -> PaginatedResponse<T> {
    let offset = cursor.unwrap_or(0);
    let page = if limit == 0 { 1 } else { offset / limit + 1 };
    paginate_from_offset(items, offset, page, limit)
}

fn paginate_from_offset<T: Clone>(items: &[T], offset: u32, page: u32, limit: u32) -> PaginatedResponse<T> {
    let total = items.len() as u32;
    let start = offset as usize;
    let end = start.saturating_add(limit as usize).min(items.len());
    let page_items = if start < items.len() && limit > 0 {
        items[start..end].to_vec()
    } else {
        Vec::new()
    };
    let mut response = PaginatedResponse::new(page_items, total, page, limit);
    response.has_more = limit > 0 && end < items.len();
    response.next_cursor = response.has_more.then(|| end.to_string());
    response
}
#[cfg(test)]
mod pagination_params_tests {
    use super::*;

    #[test]
    fn resolve_applies_defaults_when_omitted() {
        let p = PaginationParams::resolve(None, None).unwrap();
        assert_eq!(p.page, PaginationParams::DEFAULT_PAGE);
        assert_eq!(p.limit, PaginationParams::DEFAULT_LIMIT);
    }

    #[test]
    fn resolve_accepts_valid_params() {
        let p = PaginationParams::resolve(Some(2), Some(50)).unwrap();
        assert_eq!(p.page, 2);
        assert_eq!(p.limit, 50);
    }
}
