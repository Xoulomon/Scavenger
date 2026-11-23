# Security Testing Guide

## Overview

Scavenger uses two layers of security validation:

1. **Security Tests** — executable test suites that verify security behaviour at runtime (this guide).
2. **Security Scanning** — static analysis, dependency audits, and secrets scanning handled by `.github/workflows/security-scanning.yml` (SAST/CodeQL, npm audit, gitleaks, Trivy, OSSF Scorecard).

---

## Test Suites

### Contract Security Tests (`stellar-contract/tests/security_testing.rs`)

Rust integration tests for the Soroban smart contract. Covers:

- Access control: only authorised roles can call privileged functions
- Input validation at the contract boundary (overflow, invalid types, out-of-range values)
- State integrity after edge-case transactions
- Fuzz targets (run separately with `cargo test fuzz`)

### TypeScript Security Tests (`security-tests/tests/`)

API-level tests using [Vitest](https://vitest.dev/) and Axios against a running backend.

| File                       | Coverage                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `security.test.ts`         | SQL injection, XSS, CSRF, auth/authz, rate limiting, API security, basic input validation                                      |
| `input-validation.test.ts` | Empty inputs, oversized strings, special characters, SQL injection in fields, boundary values (weight, coordinates, role enum) |

---

## Running Security Tests Locally

### Contract tests

```bash
cd stellar-contract
cargo test --test security_testing

# Fuzz tests (optional)
cargo test fuzz
```

### TypeScript tests

```bash
cd security-tests
npm ci
API_URL=http://localhost:3000/api npm test
```

Set `API_URL` to point to a running instance of the backend before executing.

---

## CI Integration

The `security-tests.yml` workflow runs on every push to `main`/`develop` and on all pull requests:

- `contract-security-tests` — compiles and runs `security_testing.rs`
- `security-test-suite` — installs deps and runs `npm test` in `security-tests/`
- `security-report` — writes a Markdown summary to the GitHub Actions step summary

For static scanning coverage, see `.github/workflows/security-scanning.yml`.

---

## Security Metrics Tracked

- Number of passing/failing contract security tests
- Number of passing/failing API security tests
- OSSF Scorecard score (reported by `security-scanning.yml`)
- Known CVEs in dependencies (npm audit + RustSec)

---

## Adding New Security Tests

**Contract (Rust):** Add test functions to `stellar-contract/tests/security_testing.rs` following the existing pattern. Tag fuzz-style tests with `fuzz` in the function name so the CI fuzz step picks them up.

**API (TypeScript):** Add a new `*.test.ts` file under `security-tests/tests/` or extend an existing one. Use `describe`/`it`/`expect` from Vitest and `axios` for HTTP calls, matching the pattern in `security.test.ts`. Tests should assert that malicious input does **not** produce a 500 response and that rejected input returns 400/401/403 as appropriate.

After adding tests, verify locally with `npm test` before pushing.
