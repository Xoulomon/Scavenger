# Backend API Reference

> Auto-generated from source in `backend/src/api/`. Last scan: see git history.

This document lists every HTTP route exposed by the backend. Request/response
schemas are declared inline where the handler is typed; consumers should treat
the handler file as the source of truth until OpenAPI generation is added.

## Conventions

- **Base URL:** `${API_BASE_URL}` (see `backend/.env.example`)
- **Auth:** Bearer token in the `Authorization` header unless marked Public
- **Content type:** `application/json` for both request and response
- **Error format:** see [docs/getting-started.md](../getting-started.md) and the backend error handler

## Routes

| Method | Path | Handler | Source |
|--------|------|---------|--------|
| `GET` | `contract:stats` | `(inline)` | `backend/src/api/contracts.rs` |
| `GET` | `data_type` | `(inline)` | `backend/src/api/export.rs` |
| `GET` | `format` | `(inline)` | `backend/src/api/export.rs` |
| `GET` | `id` | `(inline)` | `backend/src/api/export.rs` |
| `GET` | `X-Cache` | `(inline)` | `backend/src/api/contracts.rs` |

## Endpoint examples

Below are representative request/response examples for the most commonly
used endpoints. Add more as consumers ask for them.

### `GET contract:stats`

Source: `backend/src/api/contracts.rs` → `(inline)`

**Request**

```http
GET contract:stats HTTP/1.1
Host: ${API_BASE_URL}
Authorization: Bearer <token>
Content-Type: application/json
```

**Response (200)**

```json
{ "ok": true, "data": "see backend/src/api/contracts.rs for the exact shape" }
```

## Adding or updating an endpoint

1. Update the handler in `backend/src/api/`.
2. Re-run the scanner in this repo's tooling, or edit this file manually.
3. Ensure request/response types are documented in the handler's doc comment.
4. Update the docs index if a new top-level section is added.
