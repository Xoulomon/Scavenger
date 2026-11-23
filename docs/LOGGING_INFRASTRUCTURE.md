# Logging Infrastructure

Centralized logging for all Scavngr services using the ELK stack (Elasticsearch, Logstash, Kibana) with Filebeat for log collection.

## Architecture

```
Services (backend, indexer)
        │  JSON logs
        ▼
    Filebeat  ──────────►  Logstash (parse + enrich)  ──────────►  Elasticsearch
                                                                          │
                                                                       Kibana
```

## Components

| Component     | Version | Port | Purpose                          |
| ------------- | ------- | ---- | -------------------------------- |
| Elasticsearch | 8.11.0  | 9200 | Log storage and indexing         |
| Logstash      | 8.11.0  | 5044 | Log parsing and enrichment       |
| Kibana        | 8.11.0  | 5601 | Visualization and search UI      |
| Filebeat      | 8.11.0  | —    | Log collection from files/Docker |

## Quick Start

```bash
# Start the full logging stack
docker compose -f docker-compose.logging.yml up -d

# Kibana UI
open http://localhost:5601

# Elasticsearch health
curl http://localhost:9200/_cluster/health
```

## Log Format

All services emit structured JSON logs:

```json
{
  "timestamp": "2026-05-29T16:10:39.324Z",
  "level": "INFO",
  "service": "backend",
  "correlation_id": "req-abc123",
  "message": "Participant registered",
  "participant_id": "GABC...",
  "role": "Recycler"
}
```

### Backend (Rust)

Set `LOG_FORMAT=json` for JSON output (default in production). Uses `tracing` + `tracing-subscriber`.

```bash
LOG_FORMAT=json RUST_LOG=info ./scavenger-backend
```

### Indexer (TypeScript)

Set `LOG_LEVEL` to control verbosity (`debug`, `info`, `warn`, `error`). Default: `info`.

```bash
LOG_LEVEL=debug node dist/index.js
```

## Log Collection

Filebeat (`config/filebeat.yml`) collects from:

- `/var/log/app/backend/*.log` — backend service logs
- `/var/log/app/indexer/*.log` — indexer service logs
- Docker container stdout/stderr via the Docker socket

## Log Parsing

Logstash (`config/logstash.conf`) handles:

- JSON parsing for both services
- Timestamp normalization to `@timestamp`
- Pino numeric level → string normalization for the indexer
- Per-service index routing: `scavngr-{service}-YYYY.MM.dd`
- Health-check log suppression (`GET /health`)
- Error tagging for alerting

## Log Retention (ILM)

Configured via `config/ilm-policy.json` and applied automatically by the `es-setup` container:

| Phase  | Age | Action                               |
| ------ | --- | ------------------------------------ |
| hot    | 0d  | Active writes, rollover at 1d / 5 GB |
| warm   | 7d  | Shrink + force-merge                 |
| cold   | 14d | Read-only, low priority              |
| delete | 30d | Index deleted                        |

Override retention per environment by editing `ilm-policy.json` before starting the stack.

## Searching Logs

### Kibana Discover

1. Open http://localhost:5601
2. Create index pattern `scavngr-*`
3. Use the Discover tab to search

### Common Queries

```
# All errors across services
level: "ERROR"

# Trace a request by correlation ID
correlation_id: "req-abc123"

# Backend errors in the last hour
service: "backend" AND level: "ERROR"

# Indexer sync events
service: "indexer" AND message: "ledger"
```

## Index Naming

| Pattern             | Contents                  |
| ------------------- | ------------------------- |
| `scavngr-backend-*` | Rust backend logs         |
| `scavngr-indexer-*` | TypeScript indexer logs   |
| `scavngr-app-*`     | Unclassified service logs |

## Configuration Files

| File                         | Purpose                             |
| ---------------------------- | ----------------------------------- |
| `docker-compose.logging.yml` | ELK + Filebeat stack definition     |
| `config/filebeat.yml`        | Filebeat input/output configuration |
| `config/logstash.conf`       | Logstash pipeline (parse + route)   |
| `config/ilm-policy.json`     | Elasticsearch ILM retention policy  |
