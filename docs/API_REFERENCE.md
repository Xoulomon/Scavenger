# Scavngr API Reference

> **Issue:** #752  
> **Version:** v1.0.1  
> **Last Updated:** 2026-07-24

---

## Table of Contents

1. [Overview](#overview)
2. [OpenAPI Specification](#openapi-specification)
3. [Authentication](#authentication)
4. [Rate Limiting](#rate-limiting)
5. [Backend REST & WebSocket API](#backend-rest--websocket-api)
6. [Indexer REST API](#indexer-rest-api)
7. [Soroban Contract API](#soroban-contract-api)
8. [TypeScript SDK](#typescript-sdk)
9. [Error Handling](#error-handling)
10. [API Versioning](#api-versioning)
11. [Changelog](#changelog)

---

## Overview

Scavngr exposes two API surfaces:

| Surface | Base URL | Purpose |
|---------|----------|---------|
| **Indexer REST API** | `http://localhost:3001` | Query indexed chain events, replay, metrics |
| **Soroban Contract** | Stellar RPC | On-chain state mutations and reads |
| **TypeScript SDK** | `@scavngr/sdk` | Typed wrapper for both surfaces |

All REST responses are JSON. All times are ISO 8601 strings unless stated otherwise.

> **This file is the single source of truth for the Indexer REST API.** External
> consumers should integrate against the [Indexer REST API](#indexer-rest-api) section
> and the [OpenAPI Specification](#openapi-specification) above it; both are derived
> from the route handlers in `indexer/src/api/server.ts` and the migrations in
> `indexer/src/db/migrations/`. Other documents in `docs/` may reference the indexer,
> but where they disagree with this file, this file is correct. Changes to indexer
> routes must update this file in the same PR.

---

## OpenAPI Specification

The Indexer REST API follows the OpenAPI 3.1 schema below.

```yaml
openapi: "3.1.0"
info:
  title: Scavngr Indexer API
  version: "1.0.0"
  description: REST API for querying indexed Scavngr blockchain events
  contact:
    name: Scavngr Developers
    url: https://github.com/Xoulomon/Scavenger

servers:
  - url: http://localhost:3001
    description: Local development
  - url: https://indexer.scavngr.io
    description: Production

tags:
  - name: health
    description: Service health and readiness
  - name: events
    description: Blockchain event queries
  - name: metrics
    description: Indexer operational metrics
  - name: replay
    description: Historical event replay

paths:
  /health:
    get:
      tags: [health]
      summary: Health check
      responses:
        "200":
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/HealthResponse"

  /metrics:
    get:
      tags: [metrics]
      summary: Indexer operational metrics
      responses:
        "200":
          description: Current metrics snapshot
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MetricsResponse"

  /events:
    get:
      tags: [events]
      summary: Query indexed events
      parameters:
        - name: type
          in: query
          schema:
            type: string
            example: recycled
        - name: from
          in: query
          schema:
            type: integer
            description: Start ledger sequence
        - name: to
          in: query
          schema:
            type: integer
            description: End ledger sequence
        - name: contractId
          in: query
          schema:
            type: string
            description: Filter by emitting contract ID
        - name: txHash
          in: query
          schema:
            type: string
            description: Filter by transaction hash
        - name: limit
          in: query
          schema:
            type: integer
            default: 100
            maximum: 1000
            description: Values above the maximum are clamped, not rejected
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        "200":
          description: Event list
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/EventListResponse"
        "500":
          $ref: "#/components/responses/InternalError"

  /events/stream:
    get:
      tags: [events]
      summary: Server-Sent Events stream of new contract events
      responses:
        "200":
          description: SSE stream
          content:
            text/event-stream:
              schema:
                type: string

  /replay:
    post:
      tags: [replay]
      summary: Trigger historical event replay
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ReplayRequest"
      responses:
        "202":
          description: Replay accepted and started
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ReplayAcceptedResponse"
        "400":
          $ref: "#/components/responses/BadRequest"
        "405":
          $ref: "#/components/responses/MethodNotAllowed"

  /replay/status/{id}:
    get:
      tags: [replay]
      summary: Get replay subsystem status
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Replay subsystem status
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ReplayStatusResponse"

  /alerts:
    get:
      tags: [metrics]
      summary: List recent alert history
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
            maximum: 200
            description: Values above the maximum are clamped, not rejected
      responses:
        "200":
          description: Alert list
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AlertListResponse"
        "500":
          $ref: "#/components/responses/InternalError"

components:
  schemas:
    HealthResponse:
      type: object
      required: [status, timestamp]
      properties:
        status:
          type: string
          enum: [ok, degraded]
        timestamp:
          type: string
          format: date-time

    MetricsResponse:
      type: object
      properties:
        eventsProcessed:
          type: integer
        eventsFailed:
          type: integer
        lastEventTimestamp:
          type: string
          format: date-time
          nullable: true
        syncLag:
          type: integer
          description: Ledger lag behind chain tip
        reorgsDetected:
          type: integer
        alertsFired:
          type: integer
        startTime:
          type: string
          format: date-time
        eventsByType:
          type: object
          additionalProperties:
            type: integer

    IndexerEvent:
      type: object
      description: >-
        A row from the raw_events table. Field names are the database column
        names and are returned verbatim in snake_case.
      properties:
        id:
          type: string
          description: BIGSERIAL primary key, serialised as a string
        ledger_sequence:
          type: string
          description: Ledger the event was emitted in
        ledger_close_time:
          type: string
          format: date-time
        transaction_hash:
          type: string
        contract_id:
          type: string
        event_type:
          type: string
          example: recycled
        topic:
          type: array
          description: Raw event topics
          items:
            type: string
        value:
          type: object
          description: Decoded event payload (JSONB)
          additionalProperties: true
        created_at:
          type: string
          format: date-time
          description: When the indexer persisted the row

    EventListResponse:
      type: object
      properties:
        events:
          type: array
          items:
            $ref: "#/components/schemas/IndexerEvent"
        total:
          type: integer
          description: Total rows matching the filters, ignoring limit/offset
        offset:
          type: integer
        limit:
          type: integer

    ReplayRequest:
      type: object
      required: [fromLedger]
      properties:
        fromLedger:
          type: integer
          description: Start ledger, inclusive. Required.
        toLedger:
          type: integer
          description: End ledger, inclusive. Omit to replay to the newest indexed ledger.
        eventTypes:
          type: array
          description: Optional event-type allow-list. Omit to replay all types.
          items:
            type: string

    ReplayAcceptedResponse:
      type: object
      properties:
        replayId:
          type: string
          example: replay_1750970400000_a1b2c3
        eventCount:
          type: integer
          description: Number of stored events selected for replay
        status:
          type: string
          enum: [started]

    ReplayStatusResponse:
      type: object
      description: >-
        Reports whether the replay subsystem is available. Per-job progress
        tracking is not implemented; the path id is accepted but ignored.
      properties:
        status:
          type: string
          enum: [available]
        message:
          type: string

    Alert:
      type: object
      description: A row from the alert_history table.
      properties:
        id:
          type: string
        alert_name:
          type: string
        severity:
          type: string
          enum: [info, warning, critical]
        message:
          type: string
        metadata:
          type: object
          nullable: true
          additionalProperties: true
        created_at:
          type: string
          format: date-time

    AlertListResponse:
      type: object
      properties:
        alerts:
          type: array
          items:
            $ref: "#/components/schemas/Alert"

    ErrorResponse:
      type: object
      required: [error]
      properties:
        error:
          type: string

  responses:
    BadRequest:
      description: Invalid request body or parameters
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
    NotFound:
      description: Unknown path
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
    MethodNotAllowed:
      description: HTTP method not supported for this path
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
    InternalError:
      description: Unhandled server error
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
```

---

## Authentication

### Stellar Wallet (Contract Calls)

All state-changing contract calls require a signed Stellar transaction from the caller's account.

**Freighter (browser):**
```typescript
import { signWithFreighter } from '@scavngr/sdk'

const client = new ScavengerClient({ ...options })
client.setSigningStrategy(signWithFreighter())
await client.registerParticipant({ ... })
```

**Secret Key (server-side / testing):**
```typescript
import { signWithSecretKey } from '@scavngr/sdk'

client.setSigningStrategy(signWithSecretKey(process.env.SECRET_KEY!))
```

### Indexer REST API

The Indexer API is **unauthenticated** by default. For production deployments behind a reverse proxy, apply API-key middleware at the gateway level (e.g., nginx `auth_request`).

---

## Rate Limiting

### Indexer API

> **Deployment note for external consumers.** The indexer ships a Redis-backed
> `RateLimiter` (`indexer/src/rate-limit/rate-limiter.ts`) with per-tier, per-endpoint
> windows plus whitelist/blacklist support, but **it is not currently attached to the
> HTTP server** — a stock `npm start` serves requests unthrottled. Public deployments
> are expected to enforce limits at the ingress/gateway layer, or to wire the limiter
> in before exposing the service. Do not assume the API will throttle you; conversely,
> do not assume it will not, since the operator may have added limits upstream.

The limiter's own contract, for operators wiring it in and for clients that need to
handle throttling:

| Concept | Behaviour |
|---------|-----------|
| Identifier | Caller-supplied string (typically API key or client IP) |
| Tier | Named group of per-endpoint `{ windowMs, maxRequests }` configs |
| Unknown tier or endpoint | Request allowed, `remaining` reported as `-1` |
| Whitelisted identifier | Always allowed, `remaining` reported as `-1` |
| Blacklisted identifier | Always denied |
| Algorithm | Sliding window over a Redis sorted set, keyed `ratelimit:{id}:{endpoint}` |

Recommended starting limits, matching the values in `.env.example`
(`RATE_LIMIT_REQUESTS_PER_MINUTE`, `RATE_LIMIT_BURST_SIZE`):

| Tier | Limit | Window |
|------|-------|--------|
| Default | 60 req | 1 minute |
| Burst | 10 req | 1 second |

When the limiter is attached, throttled requests return `429 Too Many Requests`:

```json
{ "error": "Rate limit exceeded. Retry after 42 seconds." }
```

and `getRateLimitHeaders()` supplies:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1750970400
```

`X-RateLimit-Reset` is a Unix timestamp in **seconds**. A `-1` in
`X-RateLimit-Remaining` means "not counted" (whitelisted, or no config for this
tier/endpoint), not "exhausted".

**Client guidance:** treat `429` as retryable with backoff, and page through `/events`
using `limit`/`offset` rather than issuing many small concurrent requests.

### Soroban RPC

Stellar's public RPC endpoints enforce their own rate limits. For production, run a dedicated RPC node or use a paid provider.

| Network | Public RPC | Rate Limit |
|---------|------------|-----------|
| Testnet | `https://soroban-testnet.stellar.org` | 100 req/s |
| Mainnet | `https://mainnet.sorobanrpc.com` | Contact provider |

---

## Backend REST & WebSocket API

Endpoints served by the backend (`backend/src/api`). Route registrations in `backend/src/main.rs` are checked against this section by `scripts/check-api-reference.sh`.

### 1. Global Conventions & Architecture

#### Base URL
- Local Development: `http://localhost:8080`
- Production: `https://api.scavenger.io`

#### Authentication & Headers
| Header | Type | Description | Required For |
|--------|------|-------------|--------------|
| `Authorization` | `Bearer <JWT>` | Bearer token verifying caller identity and role | Protected endpoints (Free / Premium / Admin tiers) |
| `X-CSRF-Token` | `string` | CSRF protection token | Mutating HTTP methods (`POST`, `PUT`, `DELETE`) from web browsers |
| `Idempotency-Key` | `UUIDv4` | Deduplication key ensuring safe retries on mutating endpoints | Mutating operations (`POST`, `PUT`) |
| `X-Session-ID` | `string` | Client session identifier for audit tracing | Optional |
| `X-Request-ID` | `UUIDv4` | Unique request tracking ID (auto-generated if omitted) | Injected in all responses |

#### Idempotency (`backend/src/middleware/idempotency.rs`)
`IdempotencyMiddleware` is mounted once, app-wide, in `main.rs` — it inspects **every** `POST` / `PUT` / `PATCH` / `DELETE` request across **every** route (including `signing_api.rs` and `contracts.rs`), so SDK consumers do not need to check per-endpoint whether a given write is covered.

- Send an `Idempotency-Key` header (max 128 bytes, typically a UUIDv4) on any mutating request you may need to safely retry — e.g. after a timeout or connection drop.
- The key is scoped to the exact request; reusing it replays the **original** response rather than re-running the handler.
- Response header `X-Idempotency-Status: created` marks the first (handler-executing) call for a key; `X-Idempotency-Status: replayed` marks a duplicate that returned the cached response.
- Only 2xx/4xx responses are cached — a 5xx is never cached, so retrying after a server error re-runs the handler.
- Cached entries expire after 24 hours; after that, the same key is treated as new.
- Omitting the header is allowed (the request just isn't deduplicated) except where a specific endpoint's docs say otherwise — see the per-file notes in `signing_api.rs` for operations (signing, multisig, revocation) where a retried request without this header can double-execute a sensitive action.

#### Rate Limiting Tiers
Rate limiting is enforced at the middleware layer (`backend/src/middleware/rate_limit.rs`) with tier-based quotas and window headers:

| Tier | Rate Limits | Applied Route Categories |
|------|-------------|--------------------------|
| **Anonymous** | 30 requests / min · 200 requests / hour | Public read endpoints (`/api/v1/contracts/*`, `/api/v1/search/*`) |
| **Free** | 60 requests / min · 1,000 requests / hour | Standard authenticated users (`/api/v1/audit/*`, `/ws`, general API) |
| **Premium** | 300 requests / min · 10,000 requests / hour | High-throughput integrated partners |
| **Admin** | 1,200 requests / min · 50,000 requests / hour | Internal administrative operations |

##### Standard Response Headers:
- `X-RateLimit-Limit-Minute`: Quota per minute
- `X-RateLimit-Limit-Hour`: Quota per hour
- `X-RateLimit-Remaining-Minute`: Remaining tokens in current minute window
- `X-RateLimit-Remaining-Hour`: Remaining tokens in current hour window
- `Retry-After`: (On HTTP 429) Seconds to wait before retrying

---

### 2. Health & System Endpoints

#### `GET /health`
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

### 3. Contracts & Cache API (`backend/src/api/contracts.rs`)

#### `GET /api/v1/contracts/wastes`
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

#### `GET /api/v1/contracts/wastes/{id}`
Retrieve details for a single waste submission by its identifier.

- **Auth Required**: None
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Path Parameters**: `id` (*string* or *u128*): Unique waste ID
- **Response `200 OK`**: Single `WasteResponse` object
- **Response `404 Not Found`**: `{"error": "Waste item not found"}`

#### `GET /api/v1/contracts/participants`
List registered network participants.

- **Auth Required**: None
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Query Parameters**:
  - `page` (*integer*, default `1`)
  - `limit` (*integer*, default `20`)
  - `role` (*string*, optional): Filter by role (`Recycler`, `Collector`, `Manufacturer`)
  - `search` (*string*, optional): Substring search on name or address
- **Response `200 OK`**: Paginated list of `ParticipantResponse`

#### `GET /api/v1/contracts/participants/{id}`
Retrieve a specific participant's profile and reputation stats.

- **Auth Required**: None
- **Rate Limit Tier**: Anonymous (30 RPM)
- **Path Parameters**: `id` (*string*): Participant Stellar address or ID
- **Response `200 OK`**: Single `ParticipantResponse`

#### `GET /api/v1/contracts/stats`
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

#### `GET /api/v1/contracts/info`
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

#### `POST /api/v1/cache/invalidate/waste/{id}`
Evict cached contract data for a specific waste item.

- **Auth Required**: Bearer Token (Admin / Verifier)
- **Rate Limit Tier**: Free (60 RPM)
- **Response `200 OK`**: `{"success": true, "message": "Waste cache invalidated"}`

#### `POST /api/v1/cache/invalidate/all`
Flush all on-chain cached queries.

- **Auth Required**: Bearer Token (Admin)
- **Rate Limit Tier**: Admin (1200 RPM)
- **Response `200 OK`**: `{"success": true, "message": "All contract caches invalidated"}`

#### `GET /api/v1/cache/metrics`
Retrieve cache performance metrics (hits, misses, evictions, latency).

- **Auth Required**: Bearer Token (Admin)
- **Rate Limit Tier**: Free (60 RPM)
- **Response `200 OK`**: Metrics JSON object

---

### 4. WebSocket Gateway (`backend/src/api/ws.rs`)

#### `GET /ws`
Establishes a bi-directional WebSocket connection for streaming contract events, status transitions, and notifications.

- **Auth Required**: Initiated via WebSocket frame (`Authenticate { token }`)
- **Rate Limit Tier**: Free (60 RPM connection attempts)
- **Protocol Flow**:
  1. Client connects via `ws://localhost:8080/ws`
  2. Client sends auth message: `{"type": "Authenticate", "payload": {"token": "JWT_TOKEN"}}`
  3. Server acknowledges: `{"type": "AuthSuccess"}`
  4. Client subscribes to topics: `{"type": "Subscribe", "payload": {"channel": "wastes:GBZX...3X4"}}`
  5. Server streams events: `{"type": "Event", "payload": {"channel": "wastes:GBZX...3X4", "data": {...}}}`

#### `GET /ws/health`
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

### 5. Export Services (`backend/src/api/export.rs`)

#### `POST /api/v1/exports`
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

#### `GET /api/v1/exports`
List export history for the authenticated user.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)
- **Query Parameters**: `page` (*integer*), `limit` (*integer*), `status` (*string*)

#### `GET /api/v1/exports/{id}/download`
Download the generated export file.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)
- **Response `200 OK`**: Binary file stream (`text/csv`, `application/pdf`, or `application/json`)

#### `POST /api/v1/exports/{id}/email`
Trigger sending the completed export file to the user's verified email.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)
- **Response `200 OK`**: `{"success": true, "message": "Export sent via email"}`

#### `POST /api/v1/exports/scheduled`
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

#### `GET /api/v1/exports/scheduled`
List all scheduled recurring export jobs.

#### `DELETE /api/v1/exports/scheduled/{id}`
Cancel and delete a scheduled export job.

---

### 6. Audit & Retention API (`backend/src/api/audit.rs`)

#### `GET /api/v1/audit/logs`
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

#### `GET /api/v1/audit/logs/{id}`
Retrieve a specific audit entry by ID.

#### `GET /api/v1/audit/summary`
Get aggregated audit statistics (actions per category, anomaly counts).

#### `POST /api/v1/audit/report`
Generate a formal audit report over a given time window.

#### `GET /api/v1/audit/export`
Stream raw audit records as CSV or JSON for external SIEM ingestion.

#### `POST /api/v1/audit/alerts` & `GET /api/v1/audit/alerts`
Create and list automated alert trigger rules for suspicious audit event patterns.

#### `GET /api/v1/audit/retention` & `PUT /api/v1/audit/retention`
View and configure audit data retention policies (`max_age_days`, `max_entries`, `archive_enabled`).

#### `POST /api/v1/audit/purge`
Manually execute log pruning according to configured retention rules.

---

### 7. Participant & Waste Verification (`backend/src/api/verification.rs`)

#### `POST /api/v1/verification/start`
Start the verification onboarding process for a participant.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)
- **Request Body**: `{"participant_id": "GBZX...3X4"}`
- **Response `200 OK`**: `{"success": true, "data": {"verification_id": "v-1001", "status": "pending"}}`

#### `GET /api/v1/verification/{participant_id}/status`
Query the verification status, submitted documents, and checklist progression.

- **Auth Required**: Bearer Token
- **Rate Limit Tier**: Free (60 RPM)

#### `POST /api/v1/verification/document`
Submit a KYC, recycling license, or facility certificate document for review.

- **Request Body**:
```json
{
  "participant_id": "GBZX...3X4",
  "doc_type": "recycling_license",
  "url": "https://storage.scavenger.io/docs/lic-99.pdf"
}
```

#### `POST /api/v1/verification/document/{doc_id}/verify`
Verifier marks a submitted document as verified or rejected.

#### `POST /api/v1/verification/checklist`
Submit answers for compliance inspection checklist questions.

#### `GET /api/v1/verification/pending-reviews`
List all participant verifications pending human reviewer action.

- **Auth Required**: Bearer Token (Verifier role)

#### `POST /api/v1/verification/approve` & `POST /api/v1/verification/reject`
Grant or deny final verified status to a participant.

#### `POST /api/v1/verification/{participant_id}/retry`
Reset a failed verification to allow resubmission of required documents.

---

### 8. Compliance API (`backend/src/api/compliance_api.rs`)

#### `GET /api/v1/compliance/checklists` & `POST /api/v1/compliance/checklists`
List standard regulatory compliance checklists or register new checklists.

#### `POST /api/v1/compliance/check`
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

#### `GET /api/v1/compliance/alerts` & `POST /api/v1/compliance/alert-rules`
List active compliance breach alerts and configure compliance alert threshold rules.

#### `GET /api/v1/compliance/audit-trail`
Retrieve the non-repudiable audit trail for compliance verification milestones.

#### `POST /api/v1/compliance/report`
Generate a structured compliance certification report for regulatory bodies.

---

### 9. Transaction Signing & Multi-Sig (`backend/src/api/signing_api.rs`)

#### `POST /api/v1/signing/sign`
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

#### `POST /api/v1/signing/verify`
Verify an ED25519 or Secp256k1 signature over a provided transaction payload.

#### `POST /api/v1/signing/multisig`
Create a multi-signature transaction proposal requiring $M$-of-$N$ threshold signatures.

#### `POST /api/v1/signing/multisig/sign`
Submit an additional signature to an open multi-signature proposal.

#### `POST /api/v1/signing/revoke`
Revoke an active signature or compromised key.

#### `GET /api/v1/signing/events` & `GET /api/v1/signing/revocations`
List cryptographic signing audit events and revocation logs.

#### `GET /api/v1/signing/documentation`
Returns cryptographic schemas and signing protocol documentation.

---

### 10. Search & Discovery API (`backend/src/api/search.rs`)

#### `GET /api/v1/search`
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

#### `GET /api/v1/search/suggest`
Autocomplete suggestions for search queries.

#### `GET /api/v1/search/config`
Returns search engine configuration (indexed fields, boost weights, supported facets).

---

### 11. Data Archival API (`backend/src/api/archival.rs`)

#### `POST /api/v1/archival/policies` & `GET /api/v1/archival/policies`
Create and list data archival policies defining storage tier transitions (Hot -> Warm -> Cold / S3 Glacier) and TTL intervals.

#### `GET /api/v1/archival/policies/{id}` / `PUT` / `DELETE`
Retrieve, modify, or delete a specific archival policy.

#### `GET /api/v1/archival/archives` & `POST /api/v1/archival/archives`
Query archived data bundles or manually trigger immediate archival for a block of historical records.

#### `POST /api/v1/archival/archives/{id}/restore`
Initiate unarchival to restore cold records back into primary queryable storage.

#### `GET /api/v1/archival/stats`
Returns storage volume metrics across tiers (hot database size, compressed archive volume, cost savings).

#### `GET /api/v1/archival/jobs` & `GET /api/v1/archival/jobs/{id}`
List and inspect the execution status of background compression and migration jobs.

---

### 12. Legacy Analytics Endpoint Note (`backend/src/api/analytics.rs`)

> [!NOTE]
> As part of cleanup issue #906, legacy analytics routes (`/analytics/participant/{id}`, `/analytics/global`, `/analytics/metrics/{name}`) were retired. All aggregated analytics and performance statistics are now served via the canonical **`GET /api/v1/contracts/stats`** endpoint.

---

## Indexer REST API

This section is the **canonical reference** for the indexer's public HTTP surface.
It is generated by reading the route definitions in `indexer/src/api/server.ts` and
the schema in `indexer/src/db/migrations/`; where other documents describe these
endpoints, this file wins.

### Conventions

- **Base URL** — `http://{API_HOST}:{API_PORT}`, defaulting to `0.0.0.0:3001`
  (`indexer/src/index.ts`). Production deployments front this with a gateway.
- **Content type** — every response is `application/json`, except
  `GET /events/stream`, which is `text/event-stream`.
- **No authentication** — the indexer serves public, already-public-on-chain data and
  performs no authentication or authorisation of its own. `POST /replay` is a
  privileged operation with no built-in guard; **do not expose it to the internet**.
  See [Authentication](#authentication).
- **Numeric JSON types** — `BIGINT`/`BIGSERIAL` columns are returned by the Postgres
  driver as **strings**, not numbers, to avoid precision loss. Parse
  `id`, `ledger_sequence`, and `waste_id` accordingly.
- **Snake_case payloads** — event and alert objects are database rows returned
  verbatim, so their fields are snake_case. Only the envelope fields
  (`total`, `limit`, `offset`, `replayId`, `eventCount`) are camelCase.
- **Out-of-range `limit`** — clamped to the maximum silently; it is never an error.

### Endpoint Summary

| Method | Path | Purpose | Success |
|--------|------|---------|---------|
| `GET` | `/health` | Liveness probe | `200` |
| `GET` | `/metrics` | Process metrics snapshot | `200` |
| `GET` | `/events` | Query indexed events | `200` |
| `GET` | `/events/stream` | SSE stream of new events | `200` |
| `POST` | `/replay` | Replay stored events | `202` |
| `GET` | `/replay/status/:id` | Replay subsystem status | `200` |
| `GET` | `/alerts` | Recent alert history | `200` |

---

### `GET /health`

Liveness probe. Returns unconditionally as long as the process is accepting
connections — it does **not** check database connectivity or sync lag. Use
`GET /metrics` and its `syncLag` field for readiness decisions.

**Request:**
```bash
curl -s http://localhost:3001/health
```

**Response — `200 OK`:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-26T17:23:41.008Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always `ok` while the process is serving |
| `timestamp` | string | ISO 8601 timestamp of the response |

---

### `GET /metrics`

In-memory metrics for the running indexer process. Counters reset on restart —
`startTime` tells you the epoch they are relative to.

**Request:**
```bash
curl -s http://localhost:3001/metrics
```

**Response — `200 OK`:**
```json
{
  "eventsProcessed": 14823,
  "eventsFailed": 2,
  "lastEventTimestamp": "2026-06-26T17:23:00.000Z",
  "syncLag": 1,
  "reorgsDetected": 0,
  "alertsFired": 1,
  "startTime": "2026-06-25T08:00:00.000Z",
  "eventsByType": {
    "recycled": 3201,
    "transfer": 1840,
    "reg": 500
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `eventsProcessed` | integer | Events successfully handled since start |
| `eventsFailed` | integer | Events that threw during handling |
| `lastEventTimestamp` | string \| null | Close time of the most recent event; `null` before the first event |
| `syncLag` | integer | Ledgers behind chain tip |
| `reorgsDetected` | integer | Reorganisations detected since start |
| `alertsFired` | integer | Alerts raised since start |
| `startTime` | string | Process start time |
| `eventsByType` | object | Per-event-type counts, keyed by contract event symbol |

---

### `GET /events`

Query indexed contract events. Results are ordered newest-first by
`ledger_sequence DESC, id DESC`.

**Query parameters:**

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `type` | string | — | — | Exact match on `event_type` (`recycled`, `transfer`, `confirmed`, `reg`, `rewarded`, `donated`, …) |
| `from` | integer | — | — | Start ledger sequence, inclusive |
| `to` | integer | — | — | End ledger sequence, inclusive |
| `contractId` | string | — | — | Exact match on emitting contract ID |
| `txHash` | string | — | — | Exact match on transaction hash |
| `limit` | integer | `100` | `1000` | Page size; higher values are clamped |
| `offset` | integer | `0` | — | Pagination offset |

All filters are ANDed. Unknown query parameters are ignored.

**Request:**
```bash
curl -s "http://localhost:3001/events?type=recycled&from=1000000&limit=2"
```

**Response — `200 OK`:**
```json
{
  "events": [
    {
      "id": "48211",
      "ledger_sequence": "1000123",
      "ledger_close_time": "2026-06-26T10:00:00.000Z",
      "transaction_hash": "a3f1c0b9e2d84f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a",
      "contract_id": "CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "event_type": "recycled",
      "topic": ["recycled", "42"],
      "value": {
        "waste_type": 2,
        "weight": 1000,
        "recycler": "GABCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "latitude": 40714000,
        "longitude": -74006000
      },
      "created_at": "2026-06-26T10:00:02.417Z"
    }
  ],
  "total": 3201,
  "limit": 2,
  "offset": 0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `events` | array | Rows from `raw_events` (see column reference below) |
| `total` | integer | Total rows matching the filters, ignoring `limit`/`offset` |
| `limit` | integer | Effective page size after clamping |
| `offset` | integer | Echo of the requested offset |

**`raw_events` columns:**

| Column | SQL type | JSON type | Description |
|--------|----------|-----------|-------------|
| `id` | `BIGSERIAL` | string | Monotonic insertion ID |
| `ledger_sequence` | `BIGINT` | string | Ledger the event was emitted in |
| `ledger_close_time` | `TIMESTAMPTZ` | string | Ledger close time |
| `transaction_hash` | `TEXT` | string | Emitting transaction |
| `contract_id` | `TEXT` | string | Emitting contract |
| `event_type` | `TEXT` | string | Contract event symbol |
| `topic` | `TEXT[]` | string[] | Raw event topics |
| `value` | `JSONB` | object | Decoded event payload |
| `created_at` | `TIMESTAMPTZ` | string | When the indexer persisted the row |

**Pagination:** page with `limit`/`offset` and stop when
`offset + events.length >= total`. Because ordering is newest-first, a deep paginated
scan taken while the indexer is live can skip or repeat rows as new events land at the
head. For a stable scan, pin the range with `to={current_tip}` and page within it.

**Errors:** `500` if the database query fails.

---

### `GET /events/stream`

Server-Sent Events stream of events as the indexer processes them. On connect the
server sends a `{"type":"connected"}` frame, then one frame per event, plus a
`:keepalive` comment every 15 seconds to hold the connection open through proxies.

**Request:**
```bash
curl -N -H "Accept: text/event-stream" http://localhost:3001/events/stream
```

**Response — `200 OK`, `Content-Type: text/event-stream`:**
```
data: {"type":"connected"}

data: {"event_type":"recycled","ledger_sequence":"1000456", ...}

:keepalive

data: {"event_type":"transfer","ledger_sequence":"1000457", ...}
```

Response headers: `Cache-Control: no-cache`, `Connection: keep-alive`,
`X-Accel-Buffering: no` (the last disables nginx response buffering, which would
otherwise defeat streaming).

The stream carries **live events only** — it does not replay history on connect.
Bridge the gap after a reconnect by noting the last `ledger_sequence` you saw and
backfilling with `GET /events?from={last_seen}` before trusting the stream again.

> **Known issue — this route is currently unreachable.** The dispatcher tests
> `path.startsWith('/events')` before it tests `path === '/events/stream'`, so a
> request for `/events/stream` is matched by the `/events` branch and answered with a
> JSON event page instead of an SSE stream. The behaviour documented above is what the
> handler implements; reaching it requires reordering those two branches in
> `indexer/src/api/server.ts`. Until that is fixed, external consumers should poll
> `GET /events` rather than depend on the stream.

---

### `POST /replay`

Re-dispatch stored events from `raw_events` through the event handlers. Use this to
rebuild derived tables after a handler bug fix, without re-fetching from Stellar.

The request returns as soon as the matching rows are selected; **processing continues
asynchronously** in the background. A `202` means "accepted and started", not
"finished".

> **Privileged operation.** There is no authentication on this endpoint. It replays
> events through handlers that mutate indexer tables. Keep it behind your gateway,
> bound to a private interface, or firewalled off.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fromLedger` | integer | **yes** | Start ledger, inclusive. Must be a JSON number. |
| `toLedger` | integer | no | End ledger, inclusive. Omit to replay through the newest stored event. |
| `eventTypes` | string[] | no | Restrict to these event types. Omit or pass an empty array for all types. |

**Request:**
```bash
curl -s -X POST http://localhost:3001/replay \
  -H 'Content-Type: application/json' \
  -d '{"fromLedger": 900000, "toLedger": 1000000, "eventTypes": ["recycled", "transfer"]}'
```

**Response — `202 Accepted`:**
```json
{
  "replayId": "replay_1750970400000_a1b2c3",
  "eventCount": 1284,
  "status": "started"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `replayId` | string | Correlation ID, emitted in indexer logs for this replay |
| `eventCount` | integer | Rows selected for replay |
| `status` | string | Always `started` |

**Errors:**

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{"error":"fromLedger is required"}` | `fromLedger` missing or not a number |
| `400` | `{"error":"SyntaxError: ..."}` | Body is not valid JSON |
| `405` | `{"error":"Method not allowed"}` | Any method other than `POST` |

`replayId` is a log correlation handle only — it cannot be used to poll progress (see
the next endpoint). Track a replay by grepping the indexer logs for it; failures are
logged as `Replay processing failed` with the same ID.

---

### `GET /replay/status/:id`

Reports whether the replay subsystem is available.

> **Per-job progress is not implemented.** The `:id` path segment is accepted but
> ignored, and the response is a fixed availability probe — it does not reflect the
> state of any particular replay. Treat this as a capability check, not a job poller.

**Request:**
```bash
curl -s http://localhost:3001/replay/status/replay_1750970400000_a1b2c3
```

**Response — `200 OK`:**
```json
{
  "status": "available",
  "message": "Replay status tracking is active"
}
```

---

### `GET /alerts`

Recent monitoring alerts from the `alert_history` table, newest first. This is
**history**, not currently-firing state — there is no resolved/cleared flag, so a row
here means "this alert fired at this time", not "this alert is active now".

**Query parameters:**

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | `50` | `200` | Page size; higher values are clamped |

There is no `offset` — this endpoint returns only the most recent window.

**Request:**
```bash
curl -s "http://localhost:3001/alerts?limit=10"
```

**Response — `200 OK`:**
```json
{
  "alerts": [
    {
      "id": "912",
      "alert_name": "HighSyncLag",
      "severity": "warning",
      "message": "Indexer is 5 ledgers behind chain tip",
      "metadata": { "syncLag": 5, "threshold": 3 },
      "created_at": "2026-06-26T17:20:00.000Z"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | `BIGSERIAL` primary key |
| `alert_name` | string | Alert rule name |
| `severity` | string | One of `info`, `warning`, `critical` |
| `message` | string | Human-readable description |
| `metadata` | object \| null | Rule-specific context |
| `created_at` | string | When the alert fired |

**Errors:** `500` if the database query fails.

---

### Common Error Responses

Every error body is `{"error": "<message>"}`.

| Status | Body | When |
|--------|------|------|
| `400 Bad Request` | `{"error":"fromLedger is required"}` | Invalid `POST /replay` body |
| `404 Not Found` | `{"error":"Not found"}` | Path does not match any route |
| `405 Method Not Allowed` | `{"error":"Method not allowed"}` | Wrong method on a matched path |
| `500 Internal Server Error` | `{"error":"Internal server error"}` | Unhandled exception; details are logged server-side, not returned |

Note that `500` bodies are deliberately generic. When debugging an integration,
correlate by timestamp against the indexer logs rather than expecting detail in the
response.

---

### Verifying These Docs Against a Running Instance

The examples above were written against the route handlers in
`indexer/src/api/server.ts`. To re-verify after a change:

```bash
# 1. Start Postgres and the indexer (see docs/DEVELOPER_ONBOARDING.md)
cd indexer && npm install && npm run dev

# 2. Walk the endpoints
curl -s localhost:3001/health
curl -s localhost:3001/metrics
curl -s 'localhost:3001/events?limit=1'
curl -s 'localhost:3001/alerts?limit=1'
curl -s localhost:3001/replay/status/x

# 3. Confirm error shapes
curl -s localhost:3001/nope                                   # 404
curl -s -X GET localhost:3001/replay                          # 405
curl -s -X POST localhost:3001/replay -d '{}'                 # 400
```

---

## Soroban Contract API

For the full contract function reference see [`docs/CONTRACT_DOCUMENTATION.md`](CONTRACT_DOCUMENTATION.md) and [`docs/API_REFERENCE.md`](API_REFERENCE.md).

### Quick Examples (Soroban CLI)

**Register a participant:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --network testnet \
  -- register_participant \
  --address $ADDR --role 0 --name recycler1 \
  --lat 40714000 --lon -74006000
```

**Submit waste material:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID --source $SECRET_KEY --network testnet \
  -- submit_material \
  --submitter $ADDR --waste_type 2 --weight 1000 \
  --lat 40714000 --lon -74006000
```

**Get global metrics:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID --network testnet \
  -- get_metrics
```

---

## TypeScript SDK

### Installation

```bash
npm install @scavngr/sdk
# or
yarn add @scavngr/sdk
```

### Setup

```typescript
import { ScavengerClient, Network, signWithFreighter } from '@scavngr/sdk'

const client = new ScavengerClient({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2025',
  contractId: process.env.VITE_CONTRACT_ID!,
})

// For browser (Freighter wallet)
client.setSigningStrategy(signWithFreighter())

// For server / CI (secret key)
// client.setSigningStrategy(signWithSecretKey(process.env.SECRET_KEY!))
```

### Core Methods

#### Participants

```typescript
// Register a new participant
await client.registerParticipant({
  address: 'GABC...',
  role: Role.Recycler,
  name: 'Alice',
  latitude: 40_714_000,
  longitude: -74_006_000,
})

// Get participant info
const participant: Participant | null = await client.getParticipant('GABC...')

// Check registration
const registered: boolean = await client.isParticipantRegistered('GABC...')
```

#### Waste Operations

```typescript
// Submit a material
const wasteId: bigint = await client.submitMaterial({
  submitter: 'GABC...',
  wasteType: WasteType.Plastic,
  weight: 1000n,
  latitude: 40_714_000n,
  longitude: -74_006_000n,
})

// Transfer waste
await client.transferWaste({
  wasteId,
  from: 'GABC...',
  to: 'GDEF...',
  latitude: 40_714_000n,
  longitude: -74_006_000n,
  note: 'Delivered to collector',
})

// Get waste details
const waste: Waste | null = await client.getWaste(wasteId)

// Get transfer history
const history: WasteTransfer[] = await client.getWasteTransferHistory(wasteId)
```

#### Incentives

```typescript
// Create incentive (Manufacturer only)
const incentiveId: bigint = await client.createIncentive({
  rewarder: 'GMFR...',
  wasteType: WasteType.Plastic,
  rewardPoints: 100n,
  budget: 50_000n,
})

// Get active incentives for a waste type
const incentives: Incentive[] = await client.getIncentives(WasteType.Plastic)

// Distribute rewards
await client.distributeRewards({
  wasteId,
  incentiveId,
  manufacturer: 'GMFR...',
})
```

#### Metrics

```typescript
const metrics: GlobalMetrics = await client.getMetrics()
console.log(metrics.total_wastes_count)  // number
console.log(metrics.total_tokens_earned) // bigint

const stats: ParticipantStats | null = await client.getStats('GABC...')
const supplyChain: SupplyChainStats = await client.getSupplyChainStats()
```

### Types Reference

```typescript
interface ClientOptions {
  rpcUrl: string
  networkPassphrase: string
  contractId: string
  pollTimeoutMs?: number   // default: 30000
  pollIntervalMs?: number  // default: 1500
}

enum Role        { Recycler, Collector, Manufacturer }
enum WasteType   { Paper=0, PetPlastic=1, Plastic=2, Metal=3, Glass=4, Organic=5, Electronic=6 }
enum Network     { Standalone, Testnet, Futurenet, Mainnet }

interface Participant {
  address: string; role: Role; name: string
  latitude: number; longitude: number; registered_at: number
}

interface Waste {
  waste_id: bigint; waste_type: WasteType; weight: bigint
  current_owner: string; latitude: bigint; longitude: bigint
  recycled_timestamp: number; is_active: boolean
  is_confirmed: boolean; confirmer: string
}

interface Incentive {
  id: number; rewarder: string; waste_type: WasteType
  reward_points: number; total_budget: number
  remaining_budget: number; active: boolean; created_at: number
}

interface GlobalMetrics {
  total_wastes_count: number
  total_tokens_earned: bigint
}
```

### Error Handling (SDK)

```typescript
import { ContractError, TransactionError, NetworkError } from '@scavngr/sdk'

try {
  await client.transferWaste({ ... })
} catch (err) {
  if (err instanceof ContractError) {
    // err.code maps to contract Error enum (see error codes table)
    console.error('Contract error:', err.code, err.message)
  } else if (err instanceof TransactionError) {
    console.error('Transaction failed:', err.resultCode)
  } else if (err instanceof NetworkError) {
    console.error('Network error:', err.message)
  }
}
```

---

## Error Handling

### HTTP Error Codes (Indexer API)

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 202 | Accepted (async job started) |
| 400 | Bad Request — invalid query parameters |
| 404 | Not Found — resource doesn't exist |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error |

### Soroban Contract Errors

All contract functions return `Result<T, Error>`. The numeric error code is embedded in the transaction result.

| Code | Variant | Likely Cause | Resolution |
|------|---------|-------------|------------|
| 1 | `AlreadyInitialized` | `initialize_admin` called twice | Deploy a fresh contract |
| 2 | `Unauthorized` | Non-admin called admin function | Use the correct admin key |
| 3 | `NotRegistered` | Participant not on chain | Call `register_participant` first |
| 4 | `AlreadyRegistered` | Address already exists | Address is already active |
| 5 | `NotManufacturer` | Role ≠ Manufacturer | Switch to a Manufacturer account |
| 6 | `NotWasteOwner` | Caller doesn't own waste | Use the waste's current owner address |
| 7 | `WasteNotFound` | Invalid waste ID | Check `get_participant_wastes` for valid IDs |
| 9 | `IncentiveNotFound` | Invalid incentive ID | Check `get_active_incentives` |
| 12 | `InvalidWeight` | Weight = 0 | Provide weight > 0 |
| 13 | `InvalidCoordinates` | lat/lon out of range | lat ∈ [-90M, +90M], lon ∈ [-180M, +180M] |
| 14 | `InvalidPercentage` | Sum > 100 | collector% + owner% ≤ 100 |
| 18 | `WasteDeactivated` | Waste was deactivated | Cannot be used after deactivation |
| 22 | `SelfConfirmation` | Owner confirmed own waste | Use a different confirmer address |
| 26 | `NoRewardAvailable` | Budget exhausted | Create a new incentive with fresh budget |
| 27 | `InvalidTransferRoute` | Invalid role combination | Only Recycler→Collector/Mfr, Collector→Mfr |
| 31 | `InsufficientBudget` | Budget < reward | Increase incentive budget |
| 44 | `WasteExpired` | Waste TTL elapsed | Waste can no longer be transferred |

---

## API Versioning

The Indexer REST API uses URL-free versioning; breaking changes are indicated by the `version` field in the API spec and changelog.

Current version: **v1.0**

The Soroban contract API is versioned via on-chain upgrade proposals (see `docs/CONTRACT_DOCUMENTATION.md` → Upgrade Procedures). Read-only functions are forwards-compatible; new parameters in write functions are additive.

### Deprecation Policy

- Deprecated endpoints/fields are marked in the OpenAPI spec with `deprecated: true`.
- Deprecated items are supported for a minimum of **3 months** before removal.
- Breaking changes are communicated via GitHub releases.

---

## Changelog

### v1.0.1 — 2026-07-24

**Indexer reference corrected against the implementation.** No API behaviour changed;
the previous documentation described intended rather than actual behaviour. If you
integrated against v1.0.0 docs, review the following:

- `GET /events` — default `limit` is **100** (not 50) and the maximum is **1000**
  (not 500); added the previously undocumented `contractId` and `txHash` filters.
- `GET /events` response — events are `raw_events` rows in **snake_case**
  (`ledger_sequence`, `event_type`, `transaction_hash`, `topic`, `value`), not the
  camelCase shape previously shown. `BIGINT` fields are returned as **strings**.
- `POST /replay` — only `fromLedger` is required; added the `eventTypes` filter. The
  `202` body is `{replayId, eventCount, status}`, not `{id, status, progress}`.
- `GET /replay/status/:id` — documented as an availability probe; per-job progress
  tracking does not exist, and the `:id` segment is ignored.
- `GET /alerts` — documented the `limit` parameter (default 50, max 200) and the
  actual `alert_history` row shape; this is alert *history*, not active-alert state.
- Rate limiting — corrected to state that the Redis-backed limiter is **not currently
  attached** to the HTTP server; suggested limits aligned with `.env.example`
  (60 req/min, burst 10) rather than the previously stated 100 req/min.
- Added common error responses, pagination guidance, SSE reconnect guidance, and a
  verification script.
- Flagged that `GET /events/stream` is currently shadowed by the `/events` route match
  and is unreachable until the route ordering is fixed.

### v1.0.0 — 2026-06-26

**Initial release.**

- Indexer REST API: `/health`, `/metrics`, `/events`, `/events/stream`, `/replay`, `/alerts`
- Soroban contract API: full function coverage for admin, participants, waste, incentives, rewards
- TypeScript SDK (`@scavngr/sdk`): typed wrappers for all contract functions
- Support for Freighter wallet signing and secret-key signing
- Network presets: Standalone, Testnet, Futurenet, Mainnet
- Rate limiting: 100 req/min (indexer), burst 10 req/s
- Error mapping: contract error codes 1–54, SDK error class hierarchy

### Upcoming (v1.1)

- Webhook subscriptions for real-time event delivery
- GraphQL endpoint for complex queries
- Pagination cursors (replace offset with cursor-based pagination)
