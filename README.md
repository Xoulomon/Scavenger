# Scavngr - Stellar Recycling Platform

A decentralized recycling platform built on Stellar blockchain using Soroban smart contracts. Scavngr connects recyclers, collectors, and manufacturers in a transparent and efficient ecosystem.

## Architecture Diagram

![Scavngr System Architecture](docs/architecture-diagram.svg)

> Full-size diagram: [`docs/architecture-diagram.svg`](docs/architecture-diagram.svg)  
> Shows all components (Frontend, Backend, Contract, Indexer, Stellar Network), participant roles, and data-flow for key operations (recycle, transfer, reward distribution).

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture Diagram](docs/architecture-diagram.svg) | Visual overview of all system components and data flow |
| [Backend API Reference](docs/api/backend-reference.md) | HTTP endpoints exposed by the backend |
| [Local Dev Setup Guide](docs/local-dev-setup.md) | Complete local development setup covering all four workspaces |
| [API Reference Guide](docs/API_REFERENCE.md) | Comprehensive contract function reference with examples and quick reference cards |
| [Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md) | Step-by-step testnet and mainnet deployment with rollback procedures |
| [Troubleshooting Guide](docs/TROUBLESHOOTING_GUIDE.md) | Common errors, debugging tips, and performance tuning |
| [User Guide](docs/USER_GUIDE.md) | End-user guide for the platform |
| [Security Audit](docs/SECURITY_AUDIT.md) | Security audit findings and mitigations |
| [ADR: Multi-Service Architecture](docs/adr/0001-multi-service-architecture.md) | Why the repo is split into five services |

## Project Structure

## Handsoff notes

<!-- handsoff-issue-1291 -->
- #1291: [Testing] Add test coverage reporting summary to `frontend/src/lib/validation/`

<!-- handsoff-issue-1293 -->
- #1293: [Testing] Remove redundant unit tests duplicating E2E coverage in `frontend/src/components/__tests__/`

<!-- handsoff-issue-1294 -->
- #1294: [Testing] Add test fixtures/mocks for `security-tests/` Stellar interactions
