# Getting Started

This is the single authoritative guide for setting up Scavenger locally.
If you find setup instructions elsewhere in the repo, treat them as
outdated pointers to this file.

- **Last reviewed:** see git history
- **Scope:** local development only. Deployment is covered in
  [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md).

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Clone and install](#clone-and-install)
3. [Environment variables](#environment-variables)
4. [Running the stack](#running-the-stack)
5. [Verifying your setup](#verifying-your-setup)
6. [Per-service commands](#per-service-commands)
7. [Docker reference](#docker-reference)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Node.js | 18+ | frontend, indexer, tooling |
| pnpm or npm | latest | package manager (see repo root `packageManager`) |
| Rust | stable (see `rust-toolchain.toml`) | smart contracts, backend |
| Docker + Compose | latest | local Postgres, Redis, Stellar standalone |
| Stellar CLI (`soroban`) | latest | deploy contract, invoke functions |
| Git | any recent | obviously |

Install per your OS. Verify with:

```bash
node --version
pnpm --version  # or: npm --version
rustc --version
docker --version
soroban --version
```

The Rust toolchain is pinned to `stable` in `rust-toolchain.toml`. `rustup`
picks it up automatically inside the repo.

---

## Clone and install

```bash
git clone <repo-url> scavenger
cd scavenger
```

Install dependencies in each workspace you will run:

```bash
cd frontend && npm install && cd ..
cd indexer && npm install && cd ..
```

Rust crates are fetched on the first `cargo build` or `cargo test`.

---

## Environment variables

Copy each example file and fill in the values you need. Each file's
comments say which variables are required for local development.

| File | Used by |
|------|---------|
| `.env.example` (root) | backend and Docker Compose |
| `frontend/.env.example` | frontend (Vite, `VITE_*` variables) |
| `indexer/.env.example` | indexer |

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
cp indexer/.env.example indexer/.env
```

For local development the Firebase variables are the only ones that need real
values. The Stellar variables are pre-configured for the local standalone
network. Once you deploy the contract, set the returned ID as `CONTRACT_ID` in
`.env` and `indexer/.env`, and as `VITE_CONTRACT_ID` in `frontend/.env`, then
restart the services.

---

## Running the stack

### Option A: Docker Compose (recommended)

```bash
docker compose up -d
docker compose ps   # wait for (healthy) on every service
```

Compose starts these services:

| Service | Port | Purpose |
|---------|------|---------|
| `stellar` | 8000 | Standalone Stellar network (Horizon + Soroban RPC) |
| `postgres` | 5432 | Indexer database (`scavngr`; `scripts/seed.sql` creates the `sync_status` table on first start) |
| `redis` | 6379 | Cache |
| `backend` | 8080 | REST API |
| `indexer` | 3001 | Event indexer |
| `frontend` | 5173 | Web app |

Stellar needs about 30 seconds to initialise. The indexer and frontend wait on
health checks, so do not start them before `stellar` is healthy.

### Option B: Run components directly

Start only the infrastructure, then run each workspace from the terminal:

```bash
docker compose up -d postgres redis stellar
```

Then follow [Per-service commands](#per-service-commands).

### Deploy the contract locally

Run this once the stack is up:

```bash
# Generate a keypair and fund it from the local friendbot
soroban keys generate local-deployer --network standalone
curl "http://localhost:8000/friendbot?addr=$(soroban keys address local-deployer)"

# Build and deploy
cargo build --target wasm32-unknown-unknown --release
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source local-deployer \
  --network standalone

# Set the returned contract ID in .env, then restart the services that use it
echo "CONTRACT_ID=<returned-id>" >> .env
docker compose up -d --force-recreate indexer frontend
```

Record the returned contract ID and set it as described in
[Environment variables](#environment-variables).

---

## Verifying your setup

```bash
docker compose ps                       # all services healthy
curl -sf http://localhost:8080/health   # backend responds
```

The compose file defines health checks for `stellar`, `postgres`, `redis` and
`backend`. The indexer has none, so check its logs instead:
`docker compose logs -f indexer`. Then open `http://localhost:5173`.

---

## Per-service commands

### Contract (`stellar-contract/`)

```bash
cd stellar-contract
cargo test --lib                 # unit tests
cargo test --test '*'            # integration tests
```

### Backend (`backend/`)

```bash
cd backend
cargo run --bin scavenger-backend
cargo test
```

### Indexer (`indexer/`)

```bash
cd indexer
npm run migrate                  # apply database migrations (needs a built dist/)
npm run dev                      # ts-node, watches src/
npm run test:unit
```

### Frontend (`frontend/`)

```bash
cd frontend
npm run dev                      # Vite dev server on port 5173
npm test                         # vitest
npm run lint
```

---

## Docker reference

### Compose files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Core development environment |
| `docker-compose.monitoring.yml` | Prometheus and Grafana |
| `docker-compose.logging.yml` | Loki and Promtail log aggregation |

Combine files with `-f`:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### Dockerfiles

- `frontend/Dockerfile`, `backend/Dockerfile`, `indexer/Dockerfile`

To force a full rebuild of one service:

```bash
docker compose build --no-cache <service>
docker compose up -d <service>
```

### Hot reload

- **Frontend:** Vite HMR. Edits under `frontend/src/` update the browser.
- **Backend:** `cargo-watch` restarts on changes under `backend/src/`.
- **Indexer:** `npm run dev` watches `indexer/src/`.

### Useful commands

```bash
docker compose stop                              # stop, keep volumes
docker compose down -v                           # stop and destroy volumes (fresh start)
docker compose exec backend cargo test
docker compose exec indexer npm test
docker compose exec postgres psql -U scavngr scavngr
docker compose exec redis redis-cli FLUSHALL
```

---

## Troubleshooting

**Stellar container takes too long to start.** It needs about 30 seconds.
Wait for `docker compose ps` to show `(healthy)`.

**`CONTRACT_ID` is empty.** The frontend and indexer start, but contract calls
fail. Deploy the contract and restart those services.

**Port already in use.** Stop any native PostgreSQL or Redis
(`sudo systemctl stop postgresql redis-server`), or override the host port in
a `docker-compose.override.yml`:

```yaml
services:
  frontend:
    ports:
      - "5174:5173"
```

Port 8000 must be free for the standalone Stellar network.

**Freighter wallet with the local network.** In Freighter settings, add a
custom network with:

- Horizon URL: `http://localhost:8000`
- Soroban RPC URL: `http://localhost:8000/soroban/rpc`
- Passphrase: `Standalone Network ; February 2017`
