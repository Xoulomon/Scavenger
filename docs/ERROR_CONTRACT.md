# Error Contract

**Relates to:** #1153 — Standardise error type naming between `backend/src/errors` and `indexer/src/errors`

Every service in the Scavngr stack (backend, indexer) emits errors in a single JSON envelope:

```json
{
  "error": {
    "code": "<category>.<variant>",
    "message": "Human-readable description.",
    "status": 422,
    "fields": [
      { "field": "weight", "message": "must be positive" }
    ]
  }
}
```

`fields` is present only for `validation.*` codes. `status` mirrors the HTTP status line.

---

## Canonical Code Table

Codes are **stable across releases**. HTTP status codes may change without notice; client code must key logic on `code`, not `status`.

### Authentication — `auth.*`

| Code | HTTP | Description |
|---|---|---|
| `auth.unauthorized` | 401 | Missing or invalid credentials |
| `auth.forbidden` | 403 | Credentials valid but access denied |
| `auth.token_expired` | 401 | JWT/session token has expired |
| `auth.invalid_token` | 401 | Token malformed or signature invalid |
| `auth.csrf_mismatch` | 403 | CSRF token absent or mismatched |

### Validation — `validation.*`

| Code | HTTP | Description |
|---|---|---|
| `validation.field_error` | 400/422 | Single field failed validation; `fields` array present |
| `validation.multiple_errors` | 400/422 | Several fields failed; `fields` array present |
| `validation.format_error` | 400/422 | Field value has wrong format |

### Resource Lookup — `not_found.*`

| Code | HTTP | Description |
|---|---|---|
| `not_found.<resource>` | 404 | Named resource not found (e.g. `not_found.participant`) |
| `not_found.resource` | 404 | Generic "resource not found" (indexer) |

### Database / Persistence — `database.*`

| Code | HTTP | Description |
|---|---|---|
| `database.query_failed` | 500 | Query execution or connection failure (indexer) |

> The backend does not surface `database.*` codes directly to clients; DB errors are wrapped as `internal`.

### Network / Upstream — `network.*`

| Code | HTTP | Description |
|---|---|---|
| `network.connection_failed` | 503 | Upstream service unreachable or timed out (indexer) |

### Contract (Stellar/Soroban) — `contract.*`

| Code | HTTP | Description |
|---|---|---|
| `contract.call_failed` | 500 | Soroban contract invocation failed |
| `contract.not_found` | 404 | Contract object ID not on-chain |
| `contract.invalid_state` | 409 | Contract state disallows this operation |
| `contract.insufficient_balance` | 402 | Token balance too low |
| `contract.unauthorized` | 403 | Caller not permitted by contract |

### Export — `export.*`

| Code | HTTP | Description |
|---|---|---|
| `export.csv_error` | 500 | CSV generation failed |
| `export.json_error` | 500 | JSON export failed |
| `export.pdf_error` | 500 | PDF generation failed |
| `export.serialization_error` | 500 | Data serialisation error during export |
| `export.invalid_format` | 400 | Unsupported export format requested |

### Email — `email.*`

| Code | HTTP | Description |
|---|---|---|
| `email.service_error` | 500 | Upstream email provider failed |
| `email.template_error` | 500 | Template render failed |
| `email.invalid_address` | 422 | Recipient address malformed |
| `email.delivery_failed` | 500 | SMTP delivery failure |

### Storage — `storage.*`

| Code | HTTP | Description |
|---|---|---|
| `storage.service_error` | 500 | S3 / storage backend error |
| `storage.invalid_file` | 422 | File type/size validation failed |
| `storage.not_found` | 404 | Requested file does not exist |
| `storage.upload_failed` | 500 | Upload to storage backend failed |
| `storage.quota_exceeded` | 429 | Storage quota exceeded |

### Webhook — `webhook.*`

| Code | HTTP | Description |
|---|---|---|
| `webhook.delivery_failed` | 500 | HTTP POST to webhook URL failed |
| `webhook.invalid_url` | 422 | Webhook target URL malformed |
| `webhook.not_found` | 404 | Webhook ID does not exist |
| `webhook.signature_mismatch` | 401 | Payload HMAC signature invalid |

### Notifications — `notification.*`

| Code | HTTP | Description |
|---|---|---|
| `notification.push_failed` | 500 | FCM/push notification delivery failed |
| `notification.invalid_token` | 422 | Device registration token invalid |
| `notification.service_unavailable` | 503 | Firebase/push service unreachable |

### Serialisation — `serialization.*`

| Code | HTTP | Description |
|---|---|---|
| `serialization.json_error` | 500 | JSON (de)serialisation error |
| `serialization.csv_error` | 500 | CSV (de)serialisation error |
| `serialization.decode_error` | 400 | Binary/base64 decode error |

### Analytics — `analytics.*`

| Code | HTTP | Description |
|---|---|---|
| `analytics.computation_failed` | 500 | Metric calculation error |
| `analytics.invalid_time_range` | 422 | Start/end time range invalid |
| `analytics.data_source_unavailable` | 503 | Analytics data store unreachable |

### Rate Limiting

| Code | HTTP | Description |
|---|---|---|
| `rate_limit.exceeded` | 429 | Too many requests |

### Catch-all

| Code | HTTP | Description |
|---|---|---|
| `bad_request` | 400 | Malformed request |
| `internal` | 500 | Unexpected server error |

---

## WebSocket Error Codes

WebSocket frames use a different code space (see `backend/src/errors/ws_errors.rs`):

| Code | Description |
|---|---|
| `auth.token_required` | Client sent a non-auth message before authenticating |
| `auth.invalid_token` | Authentication token failed validation |
| `channel.not_found` | Subscribe/unsubscribe to unknown channel |
| `message.unknown_type` | Unrecognised `type` field |
| `message.parse_error` | Frame was not valid JSON |
| `server.shutting_down` | Server draining connections |
| `server.heartbeat_timeout` | Client missed heartbeats |

---

## Implementation Reference

| Layer | Location | Pattern |
|---|---|---|
| Backend (Rust) | `backend/src/errors/codes.rs` | `pub const AUTH_UNAUTHORIZED: &str = "auth.unauthorized"` |
| Backend (Rust) | `backend/src/errors/types.rs` | `AppError` enum with `.code()` method |
| Indexer (TS) | `indexer/src/errors/AppError.ts` | `ErrorCode` enum with dot-notation values |
| Shared types (TS) | `packages/types/src/index.ts` | `ErrorCode` union type + `ApiError` interface |

### Adding a new code

1. Add a `pub const` to `backend/src/errors/codes.rs`.
2. Add a variant to the relevant domain enum in `backend/src/errors/types.rs` and wire it into `.code()`.
3. Add the string value to `ErrorCode` in `indexer/src/errors/AppError.ts`.
4. Add the string literal to the `ErrorCode` union in `packages/types/src/index.ts`.
5. Add the code to the table above.
6. Add a test in `backend/src/errors/tests.rs` and `indexer/tests/errors.test.ts`.

---

## Intentionally Kept Exceptions

### `src/utils/errors.ts` — root-level utility module

The file at `src/utils/errors.ts` uses hyphenated codes (`AUTH-001`, `VAL-001`, …).
This module is a standalone utility for formatting and validating error message strings
(i.e., linting message text quality). It is **not** an API error-response module and is
not consumed by the backend or indexer HTTP handlers. Its codes are internal labels and
are not sent over the wire; therefore they are deliberately excluded from this contract.
