# Scavenger Backend — Error Handling

> Issue #1073

## Goal

Every error response the Scavenger API sends to a client **must** have
the same JSON shape so client code can handle errors generically without
special-casing individual modules.

## Canonical error type

`backend/src/errors.rs` re-exports `ApiError` from `backend/src/api/errors.rs`.
Handlers import whichever path is most convenient — both resolve to the
same type.

```rust
// In a handler:
use crate::errors::ApiError;            // canonical path
// or, within the api module:
use crate::api::errors::ApiError;       // shorter relative path
```

## Response shape

All non-2xx responses have **exactly** this structure:

```json
{
  "error": {
    "code":       "NOT_FOUND",
    "message":    "Report report-abc not found",
    "request_id": "a1b2c3d4-5678-90ab-cdef-000000000000"
  }
}
```

### Field semantics

| Field        | Type   | Description |
|--------------|--------|-------------|
| `code`       | string | Machine-readable constant — see table below |
| `message`    | string | Human-readable description safe to display in a UI |
| `request_id` | string | UUID unique to this response, correlates with server logs |

### Error codes and HTTP statuses

| `ApiError` variant   | `code`                 | HTTP |
|----------------------|------------------------|------|
| `Validation(msg)`    | `VALIDATION_ERROR`     | 400  |
| `Unauthorized(msg)`  | `UNAUTHORIZED`         | 401  |
| `Forbidden(msg)`     | `FORBIDDEN`            | 403  |
| `NotFound(msg)`      | `NOT_FOUND`            | 404  |
| `Conflict(msg)`      | `CONFLICT`             | 409  |
| `Internal(msg)`      | `INTERNAL_SERVER_ERROR`| 500  |

## Service error mapping

Domain services use their own error enums (`ReportError`, `StorageError`,
etc.).  `From<ServiceError> for ApiError` implementations in
`backend/src/errors.rs` determine how each variant maps:

| Service error                       | → `ApiError` variant |
|-------------------------------------|----------------------|
| `ReportError::InvalidReport`        | `Validation`         |
| `ReportError::NotFound`             | `NotFound`           |
| `ReportError::ServiceError`         | `Internal`           |
| `StorageError::InvalidFile`         | `Validation`         |
| `StorageError::NotFound`            | `NotFound`           |
| `StorageError::ServiceError`        | `Internal`           |
| `NotificationError::InvalidToken`   | `Validation`         |
| `NotificationError::NotFound`       | `NotFound`           |
| `NotificationError::ServiceError`   | `Internal`           |
| `EmailError::InvalidEmail`          | `Validation`         |
| `EmailError::TemplateError`         | `Internal`           |
| `EmailError::ServiceError`          | `Internal`           |
| `anyhow::Error`                     | `Internal`           |

## Usage in handlers

Because `ApiError` implements `actix_web::ResponseError`, handlers return
`Result<HttpResponse, ApiError>` and use `?` to propagate errors:

```rust
use crate::errors::ApiError;

async fn generate_report_handler(
    body: web::Json<ReportRequest>,
    svc: web::Data<Arc<dyn ReportService>>,
) -> Result<HttpResponse, ApiError> {
    // The From<ReportError> impl converts automatically via ?
    let report = svc.generate_report(body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(report))
}
```

## What is NOT allowed

```rust
// ❌ Ad-hoc JSON error construction
HttpResponse::BadRequest().json(serde_json::json!({ "msg": "bad" }))

// ❌ Returning actix_web::Error directly
Err(actix_web::error::ErrorBadRequest("bad input"))

// ❌ panic!() / unwrap() in handlers
let x = something.unwrap(); // use ? or map_err instead
```
