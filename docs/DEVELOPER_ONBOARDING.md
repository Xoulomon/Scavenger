# Developer Onboarding Guide

Welcome to the Scavngr codebase. This guide gets you from zero to a running local environment and your first pull request.

> **This is the canonical setup guide.** Setup steps for the contract, indexer,
> frontend, backend, and mobile app all live here. Component READMEs cover what is
> specific to that component and link back here for setup rather than repeating it.
> If you find setup instructions duplicated elsewhere, that is a bug — please replace
> them with a link to this guide.

---

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
   - [Prerequisites](#prerequisites)
   - [Path A: Docker (recommended)](#path-a-docker-recommended)
   - [Path B: Running components directly](#path-b-running-components-directly)
   - [Environment Variables](#environment-variables)
   - [Local Run Commands](#local-run-commands)
   - [Verifying Setup](#verifying-setup)
   - [Setup Troubleshooting](#setup-troubleshooting)
2. [Project Structure Overview](#project-structure-overview)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing Guide](#testing-guide)
6. [Debugging Guide](#debugging-guide)
7. [Contribution Guidelines](#contribution-guidelines)
8. [Commit Message Standards](#commit-message-standards)
9. [Local Development Tips](#local-development-tips)

---

## Development Environment Setup

Setup instructions live in one place: **[docs/getting-started.md](./getting-started.md)**.
Follow that guide for prerequisites, environment files, Docker, and per-service commands.

## Project Structure Overview

```
Scavenger/
├── stellar-contract/          # Soroban smart contract (Rust)
│   ├── src/
│   │   ├── lib.rs             # ScavengerContract — all public functions
│   │   ├── types.rs           # Waste, Participant, Incentive, etc.
│   │   ├── errors.rs          # Error enum
│   │   ├── events.rs          # Event emitters
│   │   ├── validation.rs      # Reusable validation utilities
│   │   └── search.rs          # Search/query helpers
│   └── tests/                 # Integration tests (one file per feature)
│
├── frontend/                  # React + Vite + TypeScript + Tailwind
│   └── src/
│       ├── api/               # Contract client and Horizon API calls
│       ├── components/        # Reusable UI components
│       ├── context/           # React context (wallet, theme)
│       ├── hooks/             # Custom React hooks
│       ├── pages/             # Page-level components
│       └── types/             # TypeScript type definitions
│
├── backend/                   # Rust/Actix-web API server
│   └── src/                   # REST endpoints, indexer bridge
│
├── indexer/                   # TypeScript Stellar event indexer
│   └── src/
│       ├── handlers/          # Event handlers per contract event
│       ├── db/                # Database queries (PostgreSQL)
│       └── stellar/           # Horizon API client
│
├── docs/                      # All documentation
├── scripts/                   # Deployment and maintenance scripts
├── config/                    # Prometheus, alertmanager, etc.
├── k8s/                       # Kubernetes manifests
└── docker-compose.yml         # Local dev stack
```

### Key Files to Read First

| File | Why |
|---|---|
| `stellar-contract/src/lib.rs` | All contract functions — start here |
| `stellar-contract/src/types.rs` | Data structures (`Waste`, `Participant`, `Incentive`) |
| `stellar-contract/src/validation.rs` | Shared validation utilities |
| `frontend/src/api/` | How the frontend talks to the contract |
| `docs/ARCHITECTURE.md` | System design and data flow |
| `docs/API_REFERENCE.md` | All public contract functions documented |

---

## Development Workflow

### Branch Strategy

```
main                    ← stable, protected, CI required
  └── feature/issue-NNN-short-description   ← your work
  └── fix/issue-NNN-short-description
  └── docs/issue-NNN-short-description
  └── refactor/issue-NNN-short-description
```

### Standard Workflow

```bash
# 1. Sync with upstream before starting
git fetch upstream
git checkout main
git merge upstream/main

# 2. Create feature branch
git checkout -b feature/issue-123-add-batch-verification

# 3. Make changes, run tests frequently
cargo test                          # contract tests
cd frontend && npm test -- --run    # frontend tests

# 4. Commit in logical chunks (see commit message standards below)
git add -p                          # stage selectively
git commit -m "feat(#123): add batch verification function"

# 5. Push and open PR
git push origin feature/issue-123-add-batch-verification
# Open PR on GitHub targeting main
```

### Before Opening a PR

```bash
# Contract: format, lint, test
cargo fmt
cargo clippy -- -D warnings
cargo test

# Frontend: format, lint, build
cd frontend
npm run lint
npm run build
npm test -- --run
```

---

## Coding Standards

### Rust (Contract)

**Formatting** — enforced by `cargo fmt` (rustfmt.toml in root).

**Linting** — enforced by `cargo clippy -- -D warnings`. Zero warnings policy.

**Patterns to follow:**

```rust
// ✅ Use validation utilities from validation.rs
use crate::validation::{validate_weight, validate_coordinates};
validate_weight(waste.weight, "waste weight");

// ✅ Document all public functions
/// Registers a new participant in the supply chain.
///
/// # Arguments
/// * `address` — Stellar address (must authorize).
/// * `role`    — [`ParticipantRole`] variant.
///
/// # Errors
/// Panics `"Participant already registered"` if already registered.
pub fn register_participant(env: Env, address: Address, ...) { ... }

// ✅ Batch storage reads at the top of a function
let inst = env.storage().instance();
let status = inst.get(&KEY_STATUS).unwrap();
let admin  = inst.get(&KEY_ADMIN).unwrap();

// ❌ Avoid repeated storage reads mid-function
let status = env.storage().instance().get(&KEY_STATUS).unwrap();
// ... other code ...
let status2 = env.storage().instance().get(&KEY_STATUS).unwrap(); // redundant
```

**Error handling** — use `panic!()` for contract-level errors (Soroban converts to contract errors). Include descriptive messages.

### TypeScript (Frontend)

**Formatting** — Prettier with `.prettierrc` config.

**Linting** — ESLint with `.eslintrc.cjs`.

**Patterns:**

```typescript
// ✅ Typed contract calls
const result = await contractClient.register_participant({
  address: walletAddress,
  role: ParticipantRole.Recycler,
  name: 'My Org',
  latitude: BigInt(52_520_000),
  longitude: BigInt(13_405_000),
});

// ✅ Handle loading and error states
const { data, isLoading, error } = useContractQuery('get_participant', address);

// ✅ Use existing hooks — don't re-implement wallet logic
const { walletAddress, isConnected } = useWallet();

// ❌ Don't hardcode network URLs
const RPC_URL = import.meta.env.VITE_RPC_URL; // ✅
const RPC_URL = 'https://soroban-testnet.stellar.org'; // ❌
```

---

## Testing Guide

### Contract Tests

Tests live in `stellar-contract/tests/`. One file per feature area.

```bash
# Run all tests
cargo test

# Run a specific test file
cargo test --test waste_registration_flow_test

# Run with output (useful for debugging)
cargo test -- --nocapture

# Run a specific test function
cargo test test_register_participant_success
```

**Writing a new test:**

```rust
// stellar-contract/tests/my_feature_test.rs
#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::ScavengerContractClient;

fn setup() -> (Env, Address, ScavengerContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, stellar_scavngr_contract::ScavengerContract);
    let client = ScavengerContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    (env, admin, client)
}

#[test]
fn test_my_feature_happy_path() {
    let (env, admin, client) = setup();
    // ... test body
}

#[test]
#[should_panic(expected = "specific error message")]
fn test_my_feature_error_case() {
    let (env, _, client) = setup();
    // ... trigger error
}
```

### Frontend Tests

```bash
cd frontend

# Run all tests once
npm test -- --run

# Watch mode
npm test

# Coverage report
npm run test:coverage
```

---

## Debugging Guide

### Contract Debugging

```bash
# Run with verbose output
RUST_LOG=debug cargo test -- --nocapture

# Inspect contract storage
soroban contract read \
  --id "$CONTRACT_ID" \
  --network standalone

# Simulate a call (no state change)
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source local-deployer \
  --network standalone \
  --simulate \
  -- get_metrics
```

### Frontend Debugging

```bash
# Check what contract ID is loaded
console.log(import.meta.env.VITE_CONTRACT_ID);

# Enable verbose Soroban SDK logging
localStorage.setItem('debug', 'soroban:*');
# Reload page

# Inspect raw XDR responses
soroban contract invoke ... --verbose 2>&1 | jq .
```

### Docker Debugging

```bash
# View all service logs
docker compose logs -f

# View specific service
docker compose logs -f stellar frontend

# Open shell in a container
docker compose exec backend bash
docker compose exec stellar bash

# Check service health
docker compose ps
```

---

## Contribution Guidelines

### Opening an Issue

Before starting work, ensure an issue exists. If not, create one describing:
- What you want to add/fix
- Why it's needed
- Acceptance criteria

### Pull Request Requirements

Every PR must:

- [ ] Reference the issue it closes (`Closes #NNN` in description)
- [ ] Have a clear title: `type(#NNN): short description`
- [ ] Pass all CI checks (`cargo test`, `cargo clippy`, `npm run build`)
- [ ] Include tests for new functionality
- [ ] Update relevant documentation
- [ ] Have no merge conflicts with `main`

### PR Size Guidelines

| Size | Lines Changed | Approach |
|---|---|---|
| Small | < 200 | Single PR, fast review |
| Medium | 200–500 | Split if possible |
| Large | > 500 | Must split into smaller PRs |

### Code Review Etiquette

- **Authors**: Respond to all comments before requesting re-review
- **Reviewers**: Approve or request changes within 48 hours
- **Blocking comments**: Use `BLOCKING:` prefix for must-fix issues
- **Suggestions**: Use `SUGGESTION:` prefix for optional improvements

---

## Commit Message Standards

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(#issue): short description (max 72 chars)

Optional longer explanation. Wrap at 80 chars.
Explain WHY, not WHAT (the diff shows what).

Closes #NNN
```

### Types

| Type | When to Use |
|---|---|
| `feat` | New feature or function |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or improving tests |
| `chore` | Build process, tooling, dependencies |
| `perf` | Performance improvement |

### Examples

```bash
# ✅ Good
git commit -m "feat(#45): add batch waste submission with 25-item limit"
git commit -m "fix(#89): correct latitude validation boundary (was exclusive, now inclusive)"
git commit -m "docs(#102): add troubleshooting section for wallet connection errors"
git commit -m "refactor(#757): extract validation utilities to shared module"

# ❌ Bad
git commit -m "fix stuff"
git commit -m "WIP"
git commit -m "update files"
```

---

## Local Development Tips

### Speed Up Contract Iteration

```bash
# Use cargo-watch for auto-rebuild
cargo install cargo-watch
cargo watch -x "test 2>&1 | tail -20"

# Skip WASM build during development (use rlib only)
cargo test --lib  # faster than full test suite
```

### Use Snapshots for Stable Tests

```bash
# Update all snapshots after intentional changes
cargo test -- --update-snapshots

# Review snapshot diffs before committing
git diff stellar-contract/test_snapshots/
```

### Environment Variable Shortcuts

```bash
# Add to ~/.bashrc or ~/.zshrc
alias scav-deploy='soroban contract deploy \
  --wasm stellar-contract/target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source local-deployer \
  --network standalone'

alias scav-metrics='soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source local-deployer \
  --network standalone \
  -- get_metrics'
```

### Common Pitfalls

| Pitfall | Solution |
|---|---|
| Tests fail with "admin not set" | Call `initialize_admin` in test setup |
| Contract not found after restart | Docker volumes cleared — redeploy |
| Frontend shows stale data | Hard-refresh (Ctrl+Shift+R) or clear localStorage |
| `cargo clippy` fails on new code | Run `cargo clippy --fix` for auto-fixes |
| WASM too large | Ensure `[profile.release]` has `opt-level = "z"` in Cargo.toml |

---

*Last updated: June 2026 | Questions? Open a GitHub Discussion.*
