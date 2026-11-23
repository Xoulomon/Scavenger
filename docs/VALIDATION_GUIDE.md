# Input Validation Guide

All validation logic lives in `backend/src/validation/mod.rs`. The `ValidationMiddleware` (`backend/src/middleware/validation.rs`) enforces request-level rules before handlers run.

## Request-Level Rules (middleware)

- `POST`, `PUT`, `PATCH` requests must set `Content-Type: application/json`
- Request body must not exceed **1 MB**
- Invalid requests receive `415 Unsupported Media Type` or `413 Payload Too Large` with a JSON error body

## Field Validators

| Function                                 | Rule                                       |
| ---------------------------------------- | ------------------------------------------ |
| `validate_required(value, field)`        | Value must not be blank                    |
| `validate_min_length(value, field, min)` | Minimum string length                      |
| `validate_range(value, field, min, max)` | Numeric range check                        |
| `validate_email(email)`                  | Must contain `@` and `.`                   |
| `validate_stellar_address(addr)`         | 56 chars, starts with `G`                  |
| `validate_coordinates(lat, lon)`         | lat ∈ [-90, 90], lon ∈ [-180, 180]         |
| `validate_waste_weight(weight)`          | 1 – 1,000,000,000                          |
| `validate_name(name)`                    | 1–100 chars, letters/digits/spaces/hyphens |
| `validate_pagination(page, limit)`       | page ≥ 1, limit 1–100                      |
| `validate_export_format(format)`         | `csv`, `json`, or `pdf`                    |
| `validate_date_range(start, end)`        | `YYYY-MM-DDTHH:MM:SS` format               |
| `sanitize_string(s)`                     | Trim + strip control characters            |

## Error Format

All validation errors are returned as:

```json
{
  "errors": [
    { "field": "address", "message": "stellar address must be 56 characters starting with 'G'" },
    { "field": "weight", "message": "weight must be between 1 and 1,000,000,000" }
  ]
}
```

Use `ValidationErrors` to accumulate and serialize multiple errors:

```rust
let mut errs = ValidationErrors::new();
if let Some(e) = validate_stellar_address(&body.address) { errs.push(e); }
if let Some(e) = validate_waste_weight(body.weight)       { errs.push(e); }
if !errs.is_empty() {
    return HttpResponse::BadRequest().json(errs.to_response());
}
```
