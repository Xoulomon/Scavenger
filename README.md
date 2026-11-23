# Scavngr - Stellar Recycling Platform

A decentralized recycling platform built on Stellar blockchain using Soroban smart contracts. Scavngr connects recyclers, collectors, and manufacturers in a transparent and efficient ecosystem.

## Architecture Diagram

![Scavngr System Architecture](docs/architecture-diagram.svg)

> Full-size diagram: [`docs/architecture-diagram.svg`](docs/architecture-diagram.svg)  
> Shows all components (Frontend, Backend, Contract, Indexer, Stellar Network), participant roles, and data-flow for key operations (recycle, transfer, reward distribution).

## Documentation

| Document                                                                       | Description                                                                                         |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| [Getting Started Guide](docs/getting-started.md)                               | **Authoritative** from-scratch developer setup guide (prerequisites, env vars, verified setup path) |
| [Architecture Diagram](docs/architecture-diagram.svg)                          | Visual overview of all system components and data flow                                              |
| [Backend API Reference](docs/api/backend-reference.md)                         | HTTP endpoints exposed by the backend                                                               |
| [Local Dev Setup Guide](docs/local-dev-setup.md)                               | Complete local development setup covering all four workspaces                                       |
| [API Reference Guide](docs/API_REFERENCE.md)                                   | Comprehensive contract function reference with examples and quick reference cards                   |
| [Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md)                               | Step-by-step testnet and mainnet deployment with rollback procedures                                |
| [Troubleshooting Guide](docs/TROUBLESHOOTING_GUIDE.md)                         | Common errors, debugging tips, and performance tuning                                               |
| [User Guide](docs/USER_GUIDE.md)                                               | End-user guide for the platform                                                                     |
| [Security Audit](docs/SECURITY_AUDIT.md)                                       | Security audit findings and mitigations                                                             |
| [ADR: Multi-Service Architecture](docs/adr/0001-multi-service-architecture.md) | Why the repo is split into five services                                                            |

## Developer Setup

> The single authoritative setup guide is [`docs/getting-started.md`](docs/getting-started.md).
> The summary below mirrors it; if the two ever disagree, `docs/getting-started.md` wins.

### Prerequisites

| Tool                            | Version                   | Install                                                           |
| ------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| Rust (rustup)                   | stable, 1.75+             | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| `wasm32-unknown-unknown` target | matching toolchain        | `rustup target add wasm32-unknown-unknown`                        |
| pnpm                            | 8+                        | `corepack enable && corepack prepare pnpm@latest --activate`      |
| Soroban CLI                     | latest                    | `cargo install --locked soroban-cli --features opt`               |
| Docker + Docker Compose         | Compose v2                | https://docs.docker.com/engine/install/                           |
| Node.js                         | 18+ (for pnpm workspaces) | https://nodejs.org/                                               |

### Environment Variables

Copy the example files before starting the stack:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

| Variable                     | Used by                    | Description                                                     |
| ---------------------------- | -------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`               | backend, indexer           | PostgreSQL connection string (matches `docker-compose.dev.yml`) |
| `REDIS_URL`                  | backend, indexer           | Redis connection string                                         |
| `S3_BUCKET`                  | backend                    | Object storage bucket for uploads                               |
| `AWS_REGION`                 | backend                    | AWS region for S3                                               |
| `SENDGRID_API_KEY`           | backend                    | Transactional email delivery                                    |
| `FIREBASE_PROJECT_ID`        | backend, frontend          | Firebase project for auth                                       |
| `STELLAR_RPC_URL`            | backend, indexer, scripts  | Soroban RPC endpoint                                            |
| `CONTRACT_ID`                | backend, indexer, frontend | Deployed Scavngr contract ID                                    |
| `STELLAR_NETWORK_PASSPHRASE` | backend, indexer, scripts  | Network passphrase (testnet/mainnet)                            |
| `SOROBAN_RPC_HOST`           | scripts, Soroban CLI       | RPC host used by CLI and setup scripts                          |

### From-Scratch Setup Path

These steps are executed and verified by `scripts/verify-setup.sh` and
`scripts/check-setup-docs.sh`; keep the commands in sync with those scripts.

```bash
# 1. Clone
git clone https://github.com/<org>/scavngr.git
cd scavngr

# 2. Install toolchains
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
corepack enable && corepack prepare pnpm@latest --activate
cargo install --locked soroban-cli --features opt

# 3. Copy env examples
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. Start the dev stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 5. Verify the setup
./scripts/verify-setup.sh

# 6. Run the test suite
cargo test
```

### Backwards-Compatibility Impact

This is a documentation-only change: no source code, imports, or callers are
modified. The documented commands must continue to match the expectations of
`scripts/verify-setup.sh` and `scripts/check-setup-docs.sh`; update both the
guide and those scripts together if a command changes.

## Project Structure

## Handsoff notes

<!-- handsoff-issue-1291 -->

- #1291: [Testing] Add test coverage reporting summary to `frontend/src/lib/validation/`

<!-- handsoff-issue-1293 -->

- #1293: [Testing] Remove redundant unit tests duplicating E2E coverage in `frontend/src/components/__tests__/`

<!-- handsoff-issue-1294 -->

- #1294: [Testing] Add test fixtures/mocks for `security-tests/` Stellar interactions
