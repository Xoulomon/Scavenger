use crate::services::api::PaginatedResponse;

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