# Docker Setup

> **Moved.** Setup instructions are consolidated in
> [getting-started.md](./getting-started.md). Compose files, Docker reference and troubleshooting are in its "Docker reference" section.

## Consolidated Compose setup

All optional stacks are now defined in a single base file, `docker-compose.yml`, using
[Compose profiles](https://docs.docker.com/compose/profiles/). There is no longer a need to
combine multiple `-f` overlay files by hand.

- `docker-compose.yml` — the one base file. Contains the core services plus the optional
  stacks behind profiles.
- `docker-compose.dev.yml` — the only override, used for local development.

The former overlay files (`docker-compose.monitoring.yml`, `docker-compose.observability.yml`,
`docker-compose.logging.yml`, `docker-compose.elasticsearch.yml`) have been removed; their
services now live in the base file under the profiles below.

### Profiles

| Profile      | Services                                              |
| ------------ | ----------------------------------------------------- |
| `monitoring` | Prometheus, Grafana, Jaeger and related observability |
| `logging`    | Logging stack                                         |
| `search`     | Elasticsearch and related search services             |

### Example commands

Start only the core services (no profiles):

```bash
docker compose up
```

Start the core services plus the monitoring stack:

```bash
docker compose --profile monitoring up
```

Start the logging stack:

```bash
docker compose --profile logging up
```

Start the search stack (Elasticsearch):

```bash
docker compose --profile search up
```

Combine multiple profiles:

```bash
docker compose --profile monitoring --profile logging up
```

Local development (base file plus the dev override):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Validate the resolved configuration:

```bash
docker compose config
docker compose --profile monitoring config
```

For full setup instructions, see [getting-started.md](./getting-started.md).