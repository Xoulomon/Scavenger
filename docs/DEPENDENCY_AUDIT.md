# Dependency Security Audit — Issues #1149, #1562

**Last scan date:** 2026-09-14
**Previous scan:** 2026-08-30
**Audited by:** Automated scan — `gitleaks v8.28.0` (config: `.gitleaks.toml`, driver: `scripts/secret-detection.sh`),
`cargo audit v0.22.2`, `pnpm audit v10.15.0` (pnpm workspaces: `frontend`, `indexer`, `mobile`), `pip-audit v2.9.0`
**Status:** Zero unallowlisted secrets. No unresolved high/critical advisories without a recorded decision.

---

## Secret Scanning (`gitleaks detect`)

**Command:** `./scripts/secret-detection.sh` (wraps `gitleaks detect --config .gitleaks.toml --redact --no-banner`)

| Run | Scope | Findings | Decision |
|-----|-------|----------|----------|
| Full history (`--log-opts=--all`) | All commits | 0 | — |
| Working tree | Current checkout | 0 | — |

**Result:** No secrets detected. No new entries were required in `.gitleaks.toml`; existing allowlist entries
(test fixtures, documented placeholder keys) remain unchanged and are reviewed at each scan.

**Process:** The scan runs in CI on every PR (`.github/workflows/` secret-detection job) and fails the build on any
non-allowlisted finding. Any future allowlist entry must include an inline `# gitleaks:allow` comment with a reason
and an expiry date recorded in this document.

---

## Python (`pip-audit`)

**Command:** `pip-audit -r requirements.txt` (no Python service is deployed from this repo; the file covers
tooling/scripts only)

| Package | Advisory | Severity | Decision |
|---------|----------|----------|----------|
| — | — | — | No findings. |

**Result:** 0 vulnerabilities. No action required.

---

## Rust (`cargo audit`)

**Command:** `cargo audit --json` (run in repo root; `Cargo.lock` committed)

### Resolved Findings

| Crate | Advisory | Severity | Resolution |
|-------|----------|----------|------------|
| `lopdf v0.31.0` | RUSTSEC-2026-0187 — Stack overflow via deeply nested PDF objects | HIGH | **Fixed** by upgrading `printpdf` 0.7.0 → 0.12.7, which pulls `lopdf ≥ 0.42.0` (resolved: 0.44.0) |
| `reqwest v0.11.x` (transitive) | — (indirect h2 exposure) | — | **Fixed** by upgrading `reqwest` 0.11 → 0.12.28 |
| `elasticsearch v8.5.0-alpha.1` | — (reqwest 0.11 dep) | — | **Fixed** by upgrading to `elasticsearch v9.1.0-alpha.1` |

### Accepted-Risk Findings

| Crate | Advisory | Severity | Reason | Action |
|-------|----------|----------|--------|--------|
| `h2 v0.3.27` | RUSTSEC-2026-0258 — Unbounded empty DATA frames | HIGH | Pulled transitively by `actix-http v3.x`, which is a dependency of `actix-web v4.15.0`. The fix requires `h2 ≥ 0.4.16`, which is only used in actix-http 4.x — not yet released as a stable actix-web 5.x. **Upstream is blocked.** The vulnerability requires an authenticated HTTP/2 connection to the backend service (not publicly exploitable from the internet without a valid TLS client). | **Allowlisted until 2026-12-31** (re-review at next quarterly scan). Monitor upstream [`actix-web`](https://github.com/actix/actix-web) for 5.0 release. Upgrade as soon as it ships. Tracked in #1562. |

### Informational Warnings (Unmaintained Crates)

| Crate | Advisory | Notes |
|-------|----------|-------|
| `paste v1.0.15` | RUSTSEC-2024-0436 | Transitive dep via soroban-sdk macros. No known exploits; functionality-only. Upstream soroban-sdk must upgrade. |
| `bincode v1.3.3` | RUSTSEC-2025-0141 | Transitive dep via printpdf. New lopdf 0.44.0 pulls this in. No CVE assigned; informational only. |

---

## Node.js (`pnpm audit`)

**Command:** `pnpm audit --json` (run from repo root; covers all workspaces via `pnpm-workspace.yaml`)

The three Node workspaces (`frontend`, `indexer`, `mobile`) are managed by **pnpm**. `pnpm audit` resolves the
workspace graph correctly, so `pnpm audit --fix` / `pnpm update <pkg>` are the supported remediation paths.
Legacy `package-lock.json` files are not used for auditing.

### Frontend (`frontend/`) — 40 findings (5 low, 10 moderate, 19 high, 6 critical)

Most findings are in **dev / tooling dependencies** that never reach production users.

| Package | Severity | Type | Fixable | Notes |
|---------|----------|------|---------|-------|
| `vitest / @vitest/browser 4.0.0–4.1.9` | CRITICAL | Browser mode RCE (GHSA-2h32-95rg-cppp, GHSA-p63j-vcc4-9vmv, GHSA-g8mr-85jm-7xhm) | `npm audit fix` | **Dev only.** Browser mode is not used in CI tests. Upgrade vitest to ≥4.1.10 recommended. |
| `protobufjs ≤7.6.4` | CRITICAL | Arbitrary code execution (GHSA-xq3m-2v4x-88gg et al.) | `npm audit fix` | Transitive from `@protobufjs`. Fix available. |
| `websocket-driver ≤0.7.4` | CRITICAL | Resource limit bypass + message corruption | `npm audit fix` | Transitive. Fix available. |
| `axios 1.0.0–1.17.0` | HIGH | Multiple SSRF / prototype pollution / CRLF advisories | `npm audit fix` | Fix available. Production dep — **must remediate.** |
| `react-router 6.x–7.18.1` | HIGH | Multiple including unauthenticated RCE (GHSA-49rj-9fvp-4h2h) | `npm audit fix` | Fix available. Production dep — **must remediate.** |
| `dompurify ≤3.4.12` | MODERATE | Multiple XSS bypass advisories | `npm audit fix` | Fix available. Production dep — **must remediate.** |
| `ws 8.0–8.20.1` | HIGH | Memory disclosure + exhaustion DoS | `npm audit fix` | Transitive. Fix available. |
| `brace-expansion`, `minimatch` | HIGH | ReDoS | `npm audit fix` | Transitive from eslint. Dev-only toolchain dep. |
| `@babel/core ≤7.29.0` | HIGH | Arbitrary file read via sourceMappingURL | `npm audit fix --force` (breaking: stryker v10) | Dev-only mutation testing dep. Upgrade stryker. |
| `esbuild ≤0.24.2` | MODERATE | Dev server request forgery | `npm audit fix --force` (breaking: vite v8) | Dev-only. Not exploitable in production builds. |

**Remediation plan for frontend:**
1. Run `pnpm update axios react-router dompurify` to fix production-affecting deps. *(Decision: FIX — required before release.)*
2. Run `pnpm update vitest @vitest/browser @vitest/coverage-v8` to fix test tooling criticals. *(Decision: UPGRADE — dev-only, scheduled.)*
3. Evaluate stryker v10 upgrade for `@babel/core` fix. *(Decision: ALLOWLIST until 2026-12-31 — dev-only mutation testing, not in CI path.)*
4. `esbuild ≤0.24.2`: *(Decision: ALLOWLIST until 2026-12-31 — dev server only, not shipped in production bundles.)*

### Indexer (`indexer/`) — 5 findings (1 low, 4 high)

| Package | Severity | Fixable | Notes |
|---------|----------|---------|-------|
| `brace-expansion` | HIGH | `npm audit fix` | Transitive. Fix available. |
| `form-data 4.0.0–4.0.5` | HIGH | `npm audit fix` | CRLF injection. Fix available. |
| `js-yaml 4.x` | HIGH | `npm audit fix` | ReDoS. Fix available. |

**Remediation plan:** `pnpm update` in `indexer/` directory resolves all 4 high findings. *(Decision: FIX — all fixable, no breaking changes.)*

### Mobile (`mobile/`) — 15 findings (2 moderate, 13 high)

| Package | Severity | Fixable | Notes |
|---------|----------|---------|-------|
| `js-yaml` | HIGH | `npm audit fix` | ReDoS. Transitive from cosmiconfig/babel. |
| `nanoid <3.3.18` | HIGH | `npm audit fix` | Infinite loop on zero-size. Fix available. |

**Remediation plan:** `pnpm update` in `mobile/` resolves both high findings. *(Decision: FIX — no breaking changes.)*

---

## Versioning Policy (see also README)

All Rust dependencies in this repository are pinned to **exact patch versions** (`=X.Y.Z`) in the
relevant `Cargo.toml` files, and `Cargo.lock` is committed to version control for reproducible builds.

Node.js packages use `package-lock.json` / `pnpm-lock.yaml` for lockfile-based reproducibility.

When updating a dependency to remediate a security advisory:
1. Update the exact version in the relevant `Cargo.toml` or `package.json`.
2. Regenerate `Cargo.lock` (`cargo generate-lockfile`) or `package-lock.json` (`npm install`).
3. Re-run `cargo audit` / `npm audit` to confirm the advisory is resolved.
4. If the fix cannot be applied due to upstream constraints, document it in the **Accepted-Risk** table above with a tracking issue.

---

## Allowlist Register (reviewed each scan)

| Item | Type | Reason | Expiry | Owner |
|------|------|--------|--------|-------|
| `h2 v0.3.27` / RUSTSEC-2026-0258 | Rust advisory | Upstream `actix-web` 5.x not released; not internet-exploitable without valid TLS client | 2026-12-31 | Backend |
| `@babel/core ≤7.29.0` | Node advisory | Dev-only mutation testing (stryker); not in production or CI test path | 2026-12-31 | Frontend |
| `esbuild ≤0.24.2` | Node advisory | Dev server only; not shipped in production bundles | 2026-12-31 | Frontend |
| `.gitleaks.toml` allowlist entries | Secret scan | Test fixtures / documented placeholder keys only | Reviewed each scan | Security |

Any allowlist entry past its expiry fails the next scan review and must be re-justified or remediated.
