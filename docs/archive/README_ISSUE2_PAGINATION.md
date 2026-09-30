# Issue 2: Shared pagination extractor/utility

## What changed

- `backend/src/api/pagination.rs`: added `PaginationParams`, a shared
  extractor that centralizes the `page`/`limit` default-resolution +
  `validate_pagination` call that handlers previously duplicated inline.
  - `PaginationParams::resolve(page: Option<u32>, limit: Option<u32>) -> Result<Self, Vec<String>>`
    applies `DEFAULT_PAGE` (1) / `DEFAULT_LIMIT` (20) and runs the existing
    `validate_pagination` edge-case checks (zero limit, zero page,
    over-max limit), returning the validation error list on failure so
    callers can return a 400 without reimplementing the check.
  - `PaginationParams::paginate(&self, items: &[T])` wraps the existing
    `paginate()` free function for convenience.
  - Added unit tests for the edge cases called out in the issue: omitted
    params (defaults), zero limit, zero page, out-of-range offset, and the
    valid-params happy path.

- `backend/src/api/contracts.rs`: migrated `list_wastes` and
  `list_participants` — the two handlers with duplicated
  `query.page.unwrap_or(1)` / `query.limit.unwrap_or(20)` /
  `validate_pagination` / `error_response` boilerplate — to call
  `PaginationParams::resolve(...)` instead.

## `verification.rs` and "others"

`backend/src/api/verification.rs` was audited and does not implement
offset/limit pagination (no `page`/`limit` query fields) — there was
nothing to migrate there. `PaginationParams` is exported from
`api::pagination` for any handler added later that needs the same pattern.

## Coverage

New unit tests in `pagination.rs::pagination_params_tests` cover the
extractor directly; existing tests in `pagination_boundary_tests.rs` and
`contracts.rs`'s own pagination tests continue to exercise the end-to-end
behavior through the handlers, since the handlers' externally observable
behavior (defaults, validation errors, response envelope) is unchanged —
only the duplication was removed.
