# Scavenger Backend REST & WebSocket API Reference

This document provides a consolidated, OpenAPI-style reference for all API endpoints exposed by the Scavenger backend (`backend/src/api`).

---

## 1. Global Conventions & Architecture

### Base URL
- Local Development: `http://localhost:8080`
- Production: `https://api.scavenger.io`

### Authentication & Headers
| Header | Type | Description | Required For |
|--------|------|-------------|--------------|
| `Authorization` | `Bearer <JWT>` | Bearer token verifying caller identity and role | Protected endpoints (Free / Premium / Admin tiers) |
| `X-CSRF-Token` | `string` | CSRF protection token | Mutating HTTP methods (`POST`, `PUT`, `DELETE`) from web browsers |
| `Idempotency-Key` | `UUIDv4` | Deduplication key ensuring safe retries on mutating endpoints | Mutating operations (`POST`, `PUT`) |
| `X-Session-ID` | `string` | Client session identifier for audit tracing | Optional |
| `X-Request-ID` | `UUIDv4` | Unique request tracking ID (auto-generated if omitted) | Injected in all responses |

### Idempotency (`backend/src/middleware/idempotency.rs`)
`IdempotencyMiddleware` is mounted once, app-wide, in `main.rs` — it inspects **every** `POST` / `PUT` / `PATCH` / `DELETE` request across **every** route (including `signing_api.rs` and `contracts.rs`), so SDK consumers do not need to check per-endpoint whether a given write is covered.

- Send an `Idempotency-Key` header (max 128 bytes, typically a UUIDv4) on any mutating request you may need to safely retry — e.g. after a timeout or connection drop.
- The key is scoped to the exact request; reusing it replays the **original** response rather than re-running the handler.
- Response header `X-Idempotency-Status: created` marks the first (handler-executing) call for a key; `X-Idempotency-Status: replayed` marks a duplicate that returned the cached response.
- Only 2xx/4xx responses are cached — a 5xx is never cached, so retrying after a server error re-runs the handler.
- Cached entries expire after 24 hours; after that, the same key is treated as new.
- Omitting the header is allowed (the request just isn't deduplicated) except where a specific endpoint's docs say otherwise — see the per-file notes in `signing_api.rs` for operations (signing, multisig, revocation) where a retried request without this header can double-execute a sensitive action.

### Rate Limiting Tiers
Rate limiting is enforced at the middleware layer (`backend/src/middleware/rate_limit.rs`) with tier-based quotas and window headers:

| Tier | Rate Limits | Applied Route Categories |
|------|-------------|--------------------------|
| **Anonymous** | 30 requests / min · 200 requests / hour | Public read endpoints (`/api/v1/contracts/*`, `/api/v1/search/*`) |
| **Free** | 60 requests / min · 1,000 requests / hour | Standard authenticated users (`/api/v1/audit/*`, `/ws`, general API) |
| **Premium** | 300 requests / min · 10,000 requests / hour | High-throughput integrated partners |
| **Admin** | 1,200 requests / min · 50,000 requests / hour | Internal administrative operations |

#### Standard Response Headers:
- `X-RateLimit-Limit-Minute`: Quota per minute
- `X-RateLimit-Limit-Hour`: Quota per hour
- `X-RateLimit-Remaining-Minute`: Remaining tokens in current minute window
- `X-RateLimit-Remaining-Hour`: Remaining tokens in current hour window
- `Retry-After`: (On HTTP 429) Seconds to wait before retrying

---

## 2. Health & System Endpoints

### `GET /health`
Returns the operational status of the backend and its connected core subsystems.

- **Auth Required**: None
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "timestamp": "2026-08-25T14:30:00Z",
  "version": "1.0.0",
  "services": ["contracts", "websocket", "export", "audit", "cache"]
}
```

---

## 3. Contracts & Cache API (`backend/src/api/contracts.rs`)

### `GET /api/v1/contracts/wastes`
List waste records with filtering and pagination.

- **Auth Required**: None (Public)
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Query Parameters**:
  - `page` (*integer*, optional, default `1`): Page number
  - `limit` (*integer*, optional, default `20`, max `100`): Items per page
  - `status` (*string*, optional): Filter by status (`active`, `confirmed`, `recycled`, `frozen`)
  - `waste_type` (*string*, optional): Filter by waste material (`Plastic`, `Metal`, `Glass`, `Organic`, `Paper`, `Electronic`)
  - `participant_id` (*string*, optional): Filter by submitter or holder address
  - `sort_by` (*string*, optional): Sort field (`created_at`, `weight`)
  - `sort_order` (*string*, optional): Sort order (`asc`, `desc`)
- **Response `200 OK`**:
```json
{
  "data": [
    {
      "id": "1001",
      "waste_type": "Plastic",
      "weight": 50000,
      "status": "active",
      "location": "40.7128,-74.0060",
      "participant_id": "GBZX...3X4",
      "created_at": "2026-08-25T10:00:00Z",
      "updated_at": "2026-08-25T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

### `GET /api/v1/contracts/wastes/{id}`
Retrieve details for a single waste submission by its identifier.

- **Auth Required**: None
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Path Parameters**: `id` (*string* or *u128*): Unique waste ID
- **Response `200 OK`**: Single `WasteResponse` object
- **Response `404 Not Found`**: `{"error": "Waste item not found"}`

### `GET /api/v1/contracts/participants`
List registered network participants.

- **Auth Required**: None
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Query Parameters**:
  - `page` (*integer*, default `1`)
  - `limit` (*integer*, default `20`)
  - `role` (*string*, optional): Filter by role (`Recycler`, `Collector`, `Manufacturer`)
  - `search` (*string*, optional): Substring search on name or address
- **Response `200 OK`**: Paginated list of `ParticipantResponse`

### `GET /api/v1/contracts/participants/{id}`
Retrieve a specific participant's profile and reputation stats.

- **Auth Required**: None
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Path Parameters**: `id` (*string*): Participant Stellar address or ID
- **Response `200 OK`**: Single `ParticipantResponse`

### `GET /api/v1/contracts/stats`
Get aggregated smart contract recycling statistics and carbon impact metrics.

- **Auth Required**: None
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Response `200 OK`**:
```json
{
  "total_wastes": 1420,
  "total_participants": 285,
  "total_weight": 854000000,
  "recycled_weight": 620000000,
  "pending_approvals": 12,
  "active_participants": 194
}
```

### `GET /api/v1/contracts/info`
Get on-chain contract address, network configuration, and version metadata.

- **Auth Required**: None
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Response `200 OK`**:
```json
{
  "contract_id": "CA3D...992",
  "network": "STANDALONE",
  "version": "2.0.0",
  "last_updated": "2026-08-25T12:00:00Z",
  "total_transactions": 5420
}
```

### `POST /api/v1/cache/invalidate/waste/{id}`
Evict cached contract data for a specific waste item.

- **Auth Required**: Bearer Token (Admin / Verifier)
- **Rate Limit Tier**: Free (60 RPM)
- **Response `200 OK`**: `{"success": true, "message": "Waste cache invalidated"}`

### `POST /api/v1/cache/invalidate/all`
Flush all on-chain cached queries.

- **Auth Required**: Bearer Token (Admin)
- **Rate Limit Tier**: Admin (1200 RPM)
- **Response `200 OK`**: `{"success": true, "message": "All contract caches invalidated"}`

### `GET /api/v1/cache/metrics`
Retrieve cache performance metrics (hits, misses, evictions, latency).

- **Auth Required**: Bearer Token (Admin)
- **Rate Limit Tier**: Free (60 RPM)
- **Response `200 OK`**: Metrics JSON object

---

## 4. WebSocket Gateway (`backend/src/api/ws.rs`)

### `GET /ws`
Establishes a bi-directional WebSocket connection for streaming contract events, status transitions, and notifications.

- **Auth Required**: Initiated via WebSocket frame (`Authenticate { token }`)
- **Rate Limit Tier**: Free (60 RPM connection attempts)
- **Protocol Flow**:
  1. Client connects via `ws://localhost:8080/ws`
  2. Client sends auth message: `{"type": "Authenticate", "payload": {"token": "JWT_TOKEN"}}`
  3. Server acknowledges: `{"type": "AuthSuccess"}`
  4. Client subscribes to topics: `{"type": "Subscribe", "payload": {"channel": "wastes:GBZX...3X4"}}`
  5. Server streams events: `{"type": "Event", "payload": {"channel": "wastes:GBZX...3X4", "data": {...}}}`

### `GET /ws/health`
Check WebSocket manager health and active connection count.

- **Auth Required**: None
- **Rate Limit Tier**: Free (60 RPM)
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "active_connections": 42,
  "shutting_down": false
}
```

---

## 5. Export Services (`backend/src/api/export.rs`)

### `POST /api/v1/exports`
Request an asynchronous data export job in CSV, PDF, or JSON format.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)
- **Request Body**:
```json
{
  "format": "csv",
  "data_type": "waste_records",
  "start_date": "2026-01-01T00:00:00Z",
  "end_date": "2026-08-01T00:00:00Z",
  "anonymize": false,
  "filters": { "status": "recycled" }
}
```
- **Response `200 OK`**:
```json
{
  "id": "exp-9921",
  "format": "csv",
  "data_type": "waste_records",
  "status": "processing",
  "file_size": null,
  "created_at": "2026-08-25T14:00:00Z",
  "expires_at": "2026-08-26T14:00:00Z"
}
```

### `GET /api/v1/exports`
List export history for the authenticated user.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)
- **Query Parameters**: `page` (*integer*), `limit` (*integer*), `status` (*string*)

### `GET /api/v1/exports/{id}/download`
Download the generated export file.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)
- **Response `200 OK`**: Binary file stream (`text/csv`, `application/pdf`, or `application/json`)

### `POST /api/v1/exports/{id}/email`
Trigger sending the completed export file to the user's verified email.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)
- **Response `200 OK`**: `{"success": true, "message": "Export sent via email"}`

### `POST /api/v1/exports/scheduled`
Schedule a recurring export report.

- **Auth Required**: Bearer Token (Admin / Manufacturer)
- **Rate Limit Tier**: Free (60 RPM)
- **Request Body**:
```json
{
  "format": "pdf",
  "data_type": "compliance_summary",
  "schedule": "0 0 1 * *",
  "recipients": ["compliance@org.com"],
  "anonymize": true,
  "enabled": true
}
```

### `GET /api/v1/exports/scheduled`
List all scheduled recurring export jobs.

### `DELETE /api/v1/exports/scheduled/{id}`
Cancel and delete a scheduled export job.

---

## 6. Audit & Retention API (`backend/src/api/audit.rs`)

### `GET /api/v1/audit/logs`
Query security and compliance audit logs.

- **Auth Required**: Bearer Token (Admin / Auditor)
- **Rate Limit Tier**: Free (60 RPM)
- **Query Parameters**:
  - `page`, `limit` (*integers*)
  - `event_type` (*string*): `contract`, `admin`, `auth`, `data_access`
  - `user_id` (*string*): Filter by actor
  - `action` (*string*): Filter by action name
  - `resource_type` (*string*): Filter by affected resource
  - `start_date`, `end_date` (*ISO 8601 strings*)
  - `severity` (*string*): `info`, `warning`, `critical`
- **Response `200 OK`**: Paginated list of `AuditEntry`

### `GET /api/v1/audit/logs/{id}`
Retrieve a specific audit entry by ID.

### `GET /api/v1/audit/summary`
Get aggregated audit statistics (actions per category, anomaly counts).

### `POST /api/v1/audit/report`
Generate a formal audit report over a given time window.

### `GET /api/v1/audit/export`
Stream raw audit records as CSV or JSON for external SIEM ingestion.

### `POST /api/v1/audit/alerts` & `GET /api/v1/audit/alerts`
Create and list automated alert trigger rules for suspicious audit event patterns.

### `GET /api/v1/audit/retention` & `PUT /api/v1/audit/retention`
View and configure audit data retention policies (`max_age_days`, `max_entries`, `archive_enabled`).

### `POST /api/v1/audit/purge`
Manually execute log pruning according to configured retention rules.

---

## 7. Participant & Waste Verification (`backend/src/api/verification.rs`)

### `POST /api/v1/verification/start`
Start the verification onboarding process for a participant.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)
- **Request Body**: `{"participant_id": "GBZX...3X4"}`
- **Response `200 OK`**: `{"success": true, "data": {"verification_id": "v-1001", "status": "pending"}}`

### `GET /api/v1/verification/{participant_id}/status`
Query the verification status, submitted documents, and checklist progression.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)

### `POST /api/v1/verification/document`
Submit a KYC, recycling license, or facility certificate document for review.

- **Request Body**:
```json
{
  "participant_id": "GBZX...3X4",
  "doc_type": "recycling_license",
  "url": "https://storage.scavenger.io/docs/lic-99.pdf"
}
```

### `POST /api/v1/verification/document/{doc_id}/verify`
Verifier marks a submitted document as verified or rejected.

### `POST /api/v1/verification/checklist`
Submit answers for compliance inspection checklist questions.

### `GET /api/v1/verification/pending-reviews`
List all participant verifications pending human reviewer action.

- **Auth Required**: Bearer Token (Verifier role)

### `POST /api/v1/verification/approve` & `POST /api/v1/verification/reject`
Grant or deny final verified status to a participant.

### `POST /api/v1/verification/{participant_id}/retry`
Reset a failed verification to allow resubmission of required documents.

---

## 8. Compliance API (`backend/src/api/compliance_api.rs`)

### `GET /api/v1/compliance/checklists` & `POST /api/v1/compliance/checklists`
List standard regulatory compliance checklists or register new checklists.

### `POST /api/v1/compliance/check`
Run an automated compliance evaluation against active transactions and participant certifications.

- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "compliance_score": 98.5,
    "total_checks": 40,
    "passed": 39,
    "failed": 1
  }
}
```

### `GET /api/v1/compliance/alerts` & `POST /api/v1/compliance/alert-rules`
List active compliance breach alerts and configure compliance alert threshold rules.

### `GET /api/v1/compliance/audit-trail`
Retrieve the non-repudiable audit trail for compliance verification milestones.

### `POST /api/v1/compliance/report`
Generate a structured compliance certification report for regulatory bodies.

---

## 9. Transaction Signing & Multi-Sig (`backend/src/api/signing_api.rs`)

### `POST /api/v1/signing/sign`
Cryptographically sign a transaction payload using an authenticated hardware or custodial key.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)
- **Request Body**:
```json
{
  "transaction_id": "tx-8819",
  "signer_id": "GADM...112",
  "data": "BASE64_PAYLOAD"
}
```

### `POST /api/v1/signing/verify`
Verify an ED25519 or Secp256k1 signature over a provided transaction payload.

### `POST /api/v1/signing/multisig`
Create a multi-signature transaction proposal requiring $M$-of-$N$ threshold signatures.

### `POST /api/v1/signing/multisig/sign`
Submit an additional signature to an open multi-signature proposal.

### `POST /api/v1/signing/revoke`
Revoke an active signature or compromised key.

### `GET /api/v1/signing/events` & `GET /api/v1/signing/revocations`
List cryptographic signing audit events and revocation logs.

### `GET /api/v1/signing/documentation`
Returns cryptographic schemas and signing protocol documentation.

---

## 10. Search & Discovery API (`backend/src/api/search.rs`)

### `GET /api/v1/search`
Unified search across wastes, participants, batches, and transactions.

- **Auth Required**: None (Public)
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Query Parameters**:
  - `q` (*string*, required): Search query term
  - `from` (*integer*, default `0`): Pagination offset
  - `size` (*integer*, default `20`): Page size
  - `filters` (*array of strings*, optional): Facet filters (`type:Plastic`, `status:recycled`)
- **Response `200 OK`**:
```json
{
  "total": 45,
  "hits": [...],
  "took_ms": 12,
  "facets": {
    "waste_type": { "Plastic": 20, "Metal": 15, "Glass": 10 }
  }
}
```

### `GET /api/v1/search/suggest`
Autocomplete suggestions for search queries.

### `GET /api/v1/search/config`
Returns search engine configuration (indexed fields, boost weights, supported facets).

---

## 11. Data Archival API (`backend/src/api/archival.rs`)

### `POST /api/v1/archival/policies` & `GET /api/v1/archival/policies`
Create and list data archival policies defining storage tier transitions (Hot -> Warm -> Cold / S3 Glacier) and TTL intervals.

### `GET /api/v1/archival/policies/{id}` / `PUT` / `DELETE`
Retrieve, modify, or delete a specific archival policy.

### `GET /api/v1/archival/archives` & `POST /api/v1/archival/archives`
Query archived data bundles or manually trigger immediate archival for a block of historical records.

### `POST /api/v1/archival/archives/{id}/restore`
Initiate unarchival to restore cold records back into primary queryable storage.

### `GET /api/v1/archival/stats`
Returns storage volume metrics across tiers (hot database size, compressed archive volume, cost savings).

### `GET /api/v1/archival/jobs` & `GET /api/v1/archival/jobs/{id}`
List and inspect the execution status of background compression and migration jobs.

---

## 12. Legacy Analytics Endpoint Note (`backend/src/api/analytics.rs`)

> [!NOTE]
> As part of cleanup issue #906, legacy analytics routes (`/analytics/participant/{id}`, `/analytics/global`, `/analytics/metrics/{name}`) were retired. All aggregated analytics and performance statistics are now served via the canonical **`GET /api/v1/contracts/stats`** endpoint.
