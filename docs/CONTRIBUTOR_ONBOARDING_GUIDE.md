# Contributor Onboarding Guide

Welcome to Scavngr! This guide walks new contributors through everything needed to go from zero to a merged pull request: environment setup, project structure, conventions, testing requirements, code review guidelines, and commit message standards.

> For the full contribution policy, see [`CONTRIBUTING.md`](../CONTRIBUTING.md) at the repo root.

---

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Structure and Conventions](#project-structure-and-conventions)
3. [Testing Requirements](#testing-requirements)
4. [Code Review Guidelines](#code-review-guidelines)
5. [Commit Message Standards](#commit-message-standards)
6. [First Contribution Checklist](#first-contribution-checklist)
7. [Getting Help](#getting-help)

---

## Development Environment Setup

### Prerequisites

#### Smart Contract (Rust / Soroban)

| Tool | Version | Install |
|---|---|---|
| Rust toolchain | stable | [rustup.rs](https://rustup.rs/) |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Soroban CLI | latest | `cargo install --locked soroban-cli --features opt` |
| Docker | 20+ | [docs.docker.com](https://docs.docker.com/get-docker/) |

```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 2. Add wasm target
rustup target add wasm32-unknown-unknown

# 3. Install Soroban CLI
cargo install --locked soroban-cli --features opt
```

#### Frontend (React / TypeScript)

| Tool | Version | Install |
|---|---|---|
| Node.js | 18 LTS+ | [nodejs.org](https://nodejs.org/) or `nvm` |
| npm | bundled with Node | — |

```bash
# Using nvm (recommended)
nvm install 18
nvm use 18
```

#### Optional but Recommended

```bash
# Pre-commit hooks (catches issues before CI)
pip install pre-commit

# cargo-watch (auto-run tests on save)
cargo install cargo-watch
```

### Clone and Install

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/Scavenger.git
cd Scavenger

# 2. Add the upstream remote
git remote add upstream https://github.com/Xoulomon/Scavenger.git

# 3. Build the smart contract
cargo build

# 4. Install frontend dependencies
cd frontend && npm install && cd ..

# 5. Install pre-commit hooks (optional but recommended)
pre-commit install
```

### Verify Your Setup

```bash
# Smart contract checks
cargo fmt --check       # Formatting clean?
cargo clippy -- -D warnings  # No warnings?
cargo test              # All tests pass?

# Build WASM
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release
cd ..

# Frontend checks
cd frontend
npm run lint            # ESLint clean?
npm run type-check      # TypeScript clean?
npm test                # Tests pass?
cd ..
```

All commands should exit with code 0 before you push any changes.

### Running the Local Stack

```bash
# Start all services (contract node, indexer, backend, frontend)
docker compose up -d

# Start Stellar standalone node only
docker run --rm -it -p 8000:8000 \
  stellar/quickstart:latest --standalone --enable-soroban-rpc
```

### Environment Variables

Copy the example env file and fill in the values:

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Required | Description |
|---|---|---|
| `VITE_CONTRACT_ID` | ✅ | Deployed Soroban contract ID |
| `VITE_NETWORK` | ✅ | `TESTNET`, `MAINNET`, or `STANDALONE` |
| `VITE_RPC_URL` | ✅ | Soroban RPC endpoint |
| `VITE_FIREBASE_*` | ✅ | Firebase project credentials |

---

## Project Structure and Conventions

### Repository Layout

```
Scavenger/
├── stellar-contract/       # Soroban smart contract (Rust) — canonical logic
│   └── src/
│       ├── lib.rs          # Main contract: all public entry points
│       ├── types.rs        # Shared types: Waste, Participant, Incentive, …
│       ├── events.rs       # On-chain event emitters
│       ├── validation.rs   # Input validation helpers
│       ├── errors.rs       # Error enum
│       └── audit_log.rs    # Audit trail helpers
│
├── frontend/               # React + TypeScript UI
│   ├── src/
│   │   ├── components/     # Shared UI components
│   │   ├── pages/          # Route-level page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Soroban client, utilities
│   │   └── types/          # TypeScript type definitions
│   └── DESIGN_SYSTEM.md    # UI design tokens and component patterns
│
├── indexer/                # TypeScript event indexer
│   └── src/
│       ├── indexer.ts      # Main indexer loop
│       ├── analytics/      # Analytics service
│       ├── cache/          # Redis cache manager
│       ├── db/             # Database client and migrations
│       └── jobs/           # Background job queue
│
├── backend/                # Rust REST API (Actix-web)
├── docs/                   # All technical documentation
├── terraform/              # Infrastructure as code (AWS)
├── k8s/                    # Kubernetes manifests
├── scripts/                # Build, deploy, and utility scripts
├── tests/integration/      # End-to-end integration tests
├── performance/            # Load testing scripts
└── security-tests/         # Security / penetration test scripts
```

### Naming Conventions

#### Rust (Smart Contract)

| Kind | Convention | Example |
|---|---|---|
| Functions | `snake_case` | `register_participant` |
| Types / Structs | `PascalCase` | `ParticipantRole` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_WEIGHT` |
| Modules | `snake_case` | `audit_log` |

#### TypeScript (Frontend / Indexer)

| Kind | Convention | Example |
|---|---|---|
| React components | `PascalCase` | `WasteCard` |
| Hooks | `camelCase` with `use` prefix | `useParticipant` |
| Types / Interfaces | `PascalCase` | `WasteData` |
| Variables / functions | `camelCase` | `fetchWaste` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_RETRIES` |
| File names | `kebab-case` | `waste-card.tsx` |

### Branch Naming

```
feature/<short-description>   # New functionality
fix/<short-description>        # Bug fix
docs/<short-description>       # Documentation changes
refactor/<short-description>   # Code restructure
test/<short-description>       # Test additions
```

Examples:
- `feature/add-auction-ui`
- `fix/transfer-path-validation`
- `docs/update-onboarding-guide`

### Code Style

Run formatters before every push:

```bash
# Rust
cargo fmt

# TypeScript
cd frontend && npx prettier --write . && cd ..
```

Linting must pass with zero warnings:

```bash
# Rust
cargo clippy -- -D warnings

# TypeScript
cd frontend && npx eslint . && cd ..
```

---

## Testing Requirements

### Smart Contract Tests

All contract changes require accompanying tests in `stellar-contract/tests/` or inline `#[test]` modules:

```bash
# Run all tests
cargo test

# Run a specific test
cargo test test_register_participant

# Run with stdout visible
cargo test -- --nocapture
```

**Test structure:**

```rust
#[test]
fn test_submit_material_success() {
    let env = Env::default();
    // 1. Arrange — set up contract state
    // 2. Act    — call the function under test
    // 3. Assert — verify outcomes
}

#[test]
#[should_panic(expected = "NotRegistered")]
fn test_submit_material_unregistered_panics() {
    // Verify error paths
}
```

### Frontend Tests

Frontend tests use **Vitest** + **React Testing Library**:

```bash
cd frontend

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

**Test structure:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WasteCard } from './waste-card';

describe('WasteCard', () => {
  it('renders waste type and weight', () => {
    render(<WasteCard type="Plastic" weight={500} />);
    expect(screen.getByText('Plastic')).toBeInTheDocument();
    expect(screen.getByText('500g')).toBeInTheDocument();
  });
});
```

### Coverage Requirements

| Scope | Minimum |
|---|---|
| New code (overall) | 80% |
| Critical paths (reward distribution, transfer validation) | 100% |
| No regression | Overall coverage must not decrease |

### Integration Tests

```bash
# Run integration tests (requires Docker)
pnpm test:integration
```

---

## Code Review Guidelines

### For Contributors (Submitting a PR)

1. **Self-review first** — read your own diff before requesting review. Catch typos, debug statements, and missing tests yourself.
2. **Keep PRs focused** — one concern per PR. Separate refactors from features.
3. **Fill in the PR template** — description, motivation, testing steps, and `Closes #<issue>`.
4. **Respond promptly** — address review comments within 48 hours.
5. **Don't force-push after review starts** — use additional commits so reviewers can see what changed.
6. **Request re-review** after addressing comments.

### PR Description Template

```markdown
## Description
Brief summary of what this PR does.

## Motivation
Why this change is needed (link to issue).

## Changes
- Change 1
- Change 2

## Testing
Steps to verify this works:
1. Run `cargo test`
2. ...

## Related Issues
Closes #<issue-number>

## Checklist
- [ ] Tests added / updated
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] CI is green
```

### For Reviewers

1. **Review within 48 hours** when assigned.
2. **Be specific** — point to the exact line, explain the issue, and suggest a fix.
3. **Distinguish blocking from non-blocking** — prefix optional suggestions with "nit:" or "suggestion:".
4. **Approve promptly** when satisfied — don't let PRs stall.
5. **Focus on correctness and maintainability**, not personal style preferences that aren't in the linter.

### Review Checklist

- [ ] Logic is correct and handles edge cases
- [ ] Tests adequately cover the change
- [ ] No hardcoded secrets or debug statements
- [ ] Error messages are user-friendly and don't leak internals
- [ ] Performance impact is acceptable
- [ ] Documentation updated if public API changed
- [ ] Breaking changes are called out explicitly

---

## Commit Message Standards

This project follows **[Conventional Commits v1.0.0](https://www.conventionalcommits.org/)**.

### Format

```
<type>(<scope>): <short summary>

<body — explain WHY, not WHAT>

Closes #<issue-number>
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Build, deps, tooling, CI |
| `refactor` | Code restructure, no behaviour change |
| `test` | Adding or updating tests |
| `style` | Formatting, whitespace only |
| `perf` | Performance improvement |

### Scopes

| Scope | Area |
|---|---|
| `contract` | Rust/Soroban smart contract |
| `frontend` | React/TypeScript UI |
| `indexer` | TypeScript indexer |
| `backend` | Rust API server |
| `docs` | Documentation files |
| `ci` | GitHub Actions / CI config |
| `infra` | Terraform, Kubernetes |

### Rules

- Use **imperative mood**: "add feature" not "added feature"
- **Lowercase** first letter of summary
- **No period** at end of summary
- Summary ≤ **72 characters**
- Body lines wrapped at **72 characters**
- Always reference the closing issue at the bottom

### Examples

```
feat(contract): add seasonal multiplier for reward calculations

Manufacturers can now configure a time-bounded multiplier that
scales all reward distributions during promotional periods.
The multiplier is applied after tier-based rate selection.

Closes #412
```

```
fix(frontend): prevent crash on wallet disconnect

The wallet context provider was not guarded against undefined
on disconnection, causing an unhandled error in the header.

Closes #389
```

```
docs(contract): document reward distribution algorithm

Added detailed explanation of _reward_tokens internals including
the collector/owner split, overflow checks, and reentrancy guard.

Closes #537
```

---

## First Contribution Checklist

Use this checklist before opening your first PR:

```
Environment
  ☐ cargo test passes
  ☐ cargo fmt --check passes
  ☐ cargo clippy -- -D warnings passes
  ☐ cd frontend && npm test passes

Branch
  ☐ Branch name follows naming convention
  ☐ Branched from latest main

Code
  ☐ Tests added for new/changed behaviour
  ☐ No debug prints or commented-out code
  ☐ No hardcoded secrets
  ☐ Documentation updated (if API changed)

PR
  ☐ PR template filled in
  ☐ "Closes #<issue>" included
  ☐ CI is green
  ☐ Self-reviewed the diff
```

---

## Getting Help

- **GitHub Issues** — [github.com/Xoulomon/Scavenger/issues](https://github.com/Xoulomon/Scavenger/issues)
- **GitHub Discussions** — ask questions and share ideas
- **PR comments** — ideal for change-specific discussions
- **Documentation** — see `docs/` for technical references

### Key Documentation

| Document | Contents |
|---|---|
| [`README.md`](../README.md) | Project overview, build, deploy |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Full contribution policy |
| [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | System architecture |
| [`docs/SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) | Contract state & algorithms |
| [`docs/TESTING_AND_QA.md`](./TESTING_AND_QA.md) | Testing strategy |
| [`docs/DEV_ENVIRONMENT.md`](./DEV_ENVIRONMENT.md) | Detailed environment setup |
| [`docs/API_REFERENCE.md`](./API_REFERENCE.md) | REST API reference |
| [`QUICKSTART.txt`](../QUICKSTART.txt) | Fast-path setup |

---

Thank you for contributing to Scavngr! Every contribution — whether a typo fix or a major feature — helps build a more sustainable planet. 🌍♻️
