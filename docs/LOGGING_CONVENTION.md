# Scavenger Backend — Structured Logging Convention

> Issue #1074 · Updated by #1313

## Overview

All backend services emit **structured JSON log lines** to standard output/error so that
log aggregators (Loki, Logstash, Elasticsearch) can parse them without additional
configuration.

- **Rust backend** — uses the `log` crate macros (`log::info!`, `log::warn!`,
  `log::error!`) with key–value fields.  Output is captured and shipped by the
  Loki agent configured in `config/grafana/`.
- **Node.js indexer** — uses `StructuredLogger` from `packages/shared/src/logger.ts`.
  All levels (`debug`, `info`, `warn`, `error`) are emitted as a single JSON line to
  `console.log` / `console.warn` / `console.error`.  The log line is a flat JSON object
  containing at least `{ timestamp, level, message }` plus any additional context fields.

## Required Fields

Every log call **must** include the following key–value fields:

| Field       | Type   | Description |
|-------------|--------|-------------|
| `service`   | `&str` | Name of the service module — e.g. `"notifications"`, `"reporting"`, `"storage"`, `"email"` |
| `op`        | `&str` | Method name — e.g. `"register_device"`, `"generate_report"` |
| `outcome`   | `&str` | `"ok"` on success, `"error"` on failure, `"warn"` for soft warnings |

## Optional (but recommended) Fields

| Field            | When to include |
|------------------|-----------------|
| `request_id`     | When a request ID is propagated from the API layer |
| `user_id`        | When an authenticated user context is available |
| `error`          | The `Display` representation of the error (`%err`) |
| `bytes`          | For storage operations — size in bytes |
| `status`         | HTTP status code when calling external services |
| Resource IDs     | `file_id`, `report_id`, `message_id`, `schedule_id`, etc. |

## Log Levels

| Level   | When to use |
|---------|-------------|
| `info`  | Successful completion of any meaningful operation |
| `warn`  | Invalid inputs, rejected requests, soft failures |
| `error` | External service failures (HTTP errors, network timeouts) |
| `debug` | Verbose internals — never required in production, must not contain PII |

## PII Guidance

- **Never** log full email addresses at `info` or above.
- Use `email_domain` helpers (e.g. `"example.com"`) for correlation instead.
- Device tokens and wallet addresses must be truncated to the last 6 chars
  if included in logs above `debug`.

## Example

```rust
log::info!(
    service = "notifications",
    op = "register_device",
    outcome = "ok",
    user_id = %token.user_id,
    platform = %token.platform,
    registration_id = %registration_id;
    "device registered"
);

log::warn!(
    service = "reporting",
    op = "generate_report",
    outcome = "error",
    report_type = %request.report_type,
    error = %e;
    "generate_report validation failed"
);
```

## Querying in Grafana/Loki

```logql
# All errors across all services
{app="scavenger-backend"} | json | outcome="error"

# Errors in the notifications service only
{app="scavenger-backend"} | json | service="notifications", outcome="error"

# All operations for a specific user
{app="scavenger-backend"} | json | user_id="user-123"
```

## Banned Patterns

The following patterns are **not allowed** in service code:

```rust
// ❌ No println! in production code
println!("Starting server on port 8080");

// ❌ No bare eprintln!
eprintln!("Something went wrong: {}", e);

// ❌ No unstructured debug strings
log::info!("done"); // missing service/op/outcome fields
```

Replace them with:

```rust
// ✅ Structured, queryable
log::info!(service = "backend", op = "startup", outcome = "ok"; "server started");
```

## Indexer — JSON Log Format

The indexer uses `StructuredLogger` (`packages/shared/src/logger.ts`).  Every call
emits a **single-line JSON object** to stdout (debug/info) or stderr (warn/error):

```json
{"timestamp":"2026-09-30T08:20:16.429Z","level":"info","message":"Starting Scavngr indexer","rpcUrl":"https://soroban-testnet.stellar.org","contractId":"CA..."}
```

The fixed fields are:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 string | Time the log entry was created |
| `level` | `debug` \| `info` \| `warn` \| `error` | Log level |
| `message` | string | Human-readable description |
| `…context` | any | Additional key–value pairs spread from the `context` argument |

All four levels are emitted to the console when `enableConsole` is `true` (the
default in the indexer entrypoint):

- `debug` / `info` → `console.log`
- `warn` → `console.warn`
- `error` → `console.error` (the `Error` object is logged separately on the next line)

### Querying in Elasticsearch/Kibana

When Filebeat ships indexer stdout to Elasticsearch, use:

```kql
# All errors from the indexer
level: "error"

# Specific operation failures
level: "warn" AND message: "Shutdown initiated"
```
