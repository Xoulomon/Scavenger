# Scripts

This directory contains all operational shell scripts for the Scavenger platform.

All scripts conform to the project style guide:

- `#!/usr/bin/env bash` shebang
- `set -euo pipefail` strict mode
- `--help` / `-h` flag via a `usage()` function
- shellcheck-clean (no unexplained suppressions)
- **kebab-case** filenames (e.g. `build-wasm.sh`, not `build_wasm.sh`)

PowerShell wrappers (`*.ps1`) are **thin delegates** — they locate the corresponding
`.sh` file and invoke it via `wsl`, `bash`, or `sh`. The `.sh` is always the
canonical implementation.

---

## Script Inventory

### Build & Setup

| Script                                 | Purpose                                                                                     | Runs on     |
| -------------------------------------- | ------------------------------------------------------------------------------------------- | ----------- |
| `build-wasm.sh`                        | Compile the Soroban WASM contract and optimise it with `soroban contract optimize`.         | CI / local  |
| `build-wasm.ps1`                       | Windows wrapper → calls `build-wasm.sh` via WSL/Git-bash.                                   | Windows dev |
| `verify-setup.sh`                      | Verify local dev environment (Rust, WASM target, Soroban CLI, project files, build, tests). | CI / local  |
| `verify-setup.ps1`                     | Windows wrapper → calls `verify-setup.sh` via WSL/Git-bash.                                 | Windows dev |
| `verify-configs.sh`                    | Assert that `tsconfig.json` and `eslint.config.js` exist for each package.                  | CI          |
| `verify-participant-implementation.sh` | Grep-based sanity check that the Participant struct, functions, and tests are all in place. | CI          |
| `init-vault.sh`                        | Bootstrap HashiCorp Vault with KV secrets, policies, and Kubernetes auth role.              | Ops         |

### Testing & Verification

| Script                       | Purpose                                                                                     | Runs on       |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ------------- |
| `run-fuzz-tests.sh`          | Run the three-stage property/fuzz test suite via `cargo test`.                              | CI            |
| `test-disaster-recovery.sh`  | Full DR drill: locate latest S3 backup, restore to a test DB, validate, clean up.           | Ops (monthly) |
| `check-line-endings.sh`      | Scan the working tree for CRLF files; exit 1 if any found.                                  | CI pre-commit |
| `normalize-line-endings.sh`  | Convert all CRLF to LF across tracked text files.                                           | Local         |
| `validate-error-messages.sh` | Ensure every `new Error(...)` message starts with uppercase and ends with `.`.              | CI            |
| `secret-detection.sh`        | Run gitleaks, categorise findings, write remediation suggestions, optionally install hooks. | CI / local    |
| `check-adr-links.sh`         | Verify that ADR documents cross-link correctly.                                             | CI            |
| `check-api-reference.sh`     | Verify API reference documentation is up to date.                                           | CI            |
| `check-no-txt-docs.sh`       | Ensure no plain-text docs exist (Markdown only).                                            | CI            |
| `check-setup-docs.sh`        | Verify setup documentation references are valid.                                            | CI            |
| `check-env-parity.mjs`       | Check that environment variable sets are consistent across packages.                        | CI            |
| `check-package-deps.mjs`     | Verify package dependency consistency.                                                      | CI            |

### Deployment & Operations

| Script                     | Purpose                                                                                                                                                                                                 | Runs on              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `blue-green-deploy.sh`     | Kubernetes blue-green deployment with smoke tests, traffic switch, and auto-rollback.                                                                                                                   | CI CD / Ops          |
| `monitor-deployment.sh`    | Monitor a running Kubernetes deployment for errors over a configurable window.                                                                                                                          | Called by blue-green |
| `release.sh`               | Unified release tool — subcommands: `notes`, `changelog`, `track`, `publish`. Consolidates the former `release-automation.sh`, `release-notes.sh`, `release-tracking.sh`, and `changelog-generator.sh`. | CI CD                |
| `multi-region-failover.sh` | Orchestrate a cross-region failover.                                                                                                                                                                    | Ops                  |
| `test-multi-region.sh`     | Smoke-test multi-region routing.                                                                                                                                                                        | CI                   |
| `test-failover.sh`         | End-to-end failover validation.                                                                                                                                                                         | CI                   |
| `region-health-check.sh`   | Check health endpoints in all configured regions.                                                                                                                                                       | Monitoring           |

### Database

| Script                     | Purpose                                                                                               | Runs on           |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------- |
| `backup-database.sh`       | Dump, compress, verify, and upload the Postgres database to S3.                                       | Scheduled (daily) |
| `verify-backup-restore.sh` | Verify a backup can be restored successfully.                                                         | Ops               |
| `monitor-replication.sh`   | Check Postgres replication lag and alert if above threshold.                                          | Monitoring        |
| `seed-test-data.ts`        | Programmatic test data seeder (TypeScript). Supports `DRY_RUN` and `CLEAN` modes.                     | CI / local        |
| `seed-test-data.sql`       | Static SQL test data seeder. Used by Docker Compose for schema init and by `psql` for manual seeding. | CI / local        |

### CDN & Load Balancing

| Script                   | Purpose                                                   | Runs on     |
| ------------------------ | --------------------------------------------------------- | ----------- |
| `cdn-invalidation.sh`    | Create a CloudFront invalidation and wait for completion. | CI CD / Ops |
| `cdn-monitor.sh`         | Monitor CloudFront distribution metrics.                  | Monitoring  |
| `check-load-balancer.sh` | Report ALB target health and CloudWatch metrics.          | Monitoring  |

### Cost & Capacity

| Script                    | Purpose                                                                                                                                                                                                                       | Runs on |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `cost.sh`                 | Unified cloud cost tool — subcommands: `analysis`, `report`, `allocation`, `recommendations`. Consolidates the former `cost-analysis.sh`, `cost-report.sh`, `cost-allocation.sh`, and `cost-optimization-recommendations.sh`. | Ops     |
| `capacity-forecast.sh`    | Project future capacity requirements.                                                                                                                                                                                         | Ops     |
| `test-capacity.sh`        | Run capacity planning smoke-tests.                                                                                                                                                                                            | CI      |
| `test-cost-monitoring.sh` | Verify cost monitoring alarms are properly configured.                                                                                                                                                                        | CI      |

### Feature Flags

| Script                   | Purpose                                                              | Runs on     |
| ------------------------ | -------------------------------------------------------------------- | ----------- |
| `audit-feature-flags.sh` | Check each known flag for usage across source, docs, and test files. | CI          |
| `remove-feature-flag.sh` | Strip a flag from all source files after backing them up.            | Local / Ops |

### Security

| Script              | Purpose                                                          | Runs on         |
| ------------------- | ---------------------------------------------------------------- | --------------- |
| `rotate-secrets.sh` | Rotate application secrets and update Vault/AWS Secrets Manager. | Ops (scheduled) |

### Coverage & Code Quality

| Script                           | Purpose                                                                         | Runs on    |
| -------------------------------- | ------------------------------------------------------------------------------- | ---------- |
| `generate-coverage.sh`           | Run coverage instrumentation and generate HTML + lcov reports for all packages. | CI         |
| `coverage-report.ts`             | Collect per-package coverage JSON summaries and print a combined report.        | CI         |
| `generate-contract-reference.py` | Generate contract API reference documentation.                                  | CI / local |
| `load-test.sh`                   | Simple wrk load test runner.                                                    | CI         |

---

## Running Scripts

```bash
# All scripts support --help
./scripts/build-wasm.sh --help
./scripts/verify-setup.sh --help

# Dry-run where supported
DRY_RUN=1 ./scripts/rotate-secrets.sh

# On Windows (PowerShell 7+ with WSL or Git-bash)
.\scripts\build-wasm.ps1
.\scripts\verify-setup.ps1
```

## Adding a New Script

1. Use `#!/usr/bin/env bash` as the shebang.
2. Add `set -euo pipefail` immediately after the header comment.
3. Implement a `usage()` function and handle `--help` / `-h`.
4. Run `shellcheck scripts/your-script.sh` before committing — must be clean.
5. Use **kebab-case** for the filename (e.g. `my-script.sh`, not `my_script.sh`).
6. Add an entry to this README.
7. If Windows support is needed, add a thin `.ps1` wrapper that calls the `.sh`.
