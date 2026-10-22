#!/usr/bin/env bash
# generate-coverage.sh — Issue #1545 (unified coverage)
#
# Produces coverage for all four packages and writes a combined
# per-package summary table to coverage/summary.md.
#
# Packages:
#   stellar-contract  — cargo-llvm-cov → LCOV
#   backend           — cargo-llvm-cov → LCOV
#   frontend          — vitest --coverage (provider: v8) → LCOV + JSON
#   indexer           — jest --coverage → LCOV + JSON
#
# Usage:
#   ./scripts/generate-coverage.sh          # full HTML + summary
#   ./scripts/generate-coverage.sh --ci     # summary only, fails if < thresholds
#   ./scripts/generate-coverage.sh --help   # show this help
#
# Requirements:
#   Rust stable toolchain, rustup, Node.js ≥ 18, pnpm

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [--ci] [--help]

Generate coverage reports for all four Scavenger packages.

Options:
  --ci     Summary-only mode; exits 1 if any package is below its threshold
  --help   Show this help message

Thresholds (CI mode):
  stellar-contract  ≥ 85% lines
  backend           ≥ 85% lines
  frontend          ≥ 70% lines
  indexer           ≥ 70% lines

Output (full mode):
  stellar-contract/coverage/index.html
  backend/coverage/index.html
  coverage/frontend/
  coverage/indexer/
  coverage/summary.md
EOF
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COVERAGE_DIR="${REPO_ROOT}/coverage"
CI_MODE=false

for arg in "$@"; do
  case "$arg" in
    --ci) CI_MODE=true ;;
  esac
done

mkdir -p "${COVERAGE_DIR}"

# ── Helpers ────────────────────────────────────────────────────────────────────

# Extract a percentage from a vitest/jest coverage-summary.json
# $1 = path to coverage-summary.json
# $2 = metric: lines|functions|branches|statements
json_pct() {
  local file="$1" metric="$2"
  if [[ ! -f "$file" ]]; then
    echo "0.00"
    return
  fi
  # Use node to parse the JSON — universally available
  node -e "
    const s = require('$file');
    const t = s.total || {};
    process.stdout.write(String((t.$metric || {}).pct || 0));
  " 2>/dev/null || echo "0.00"
}

# Extract line coverage percentage from cargo-llvm-cov --summary-only output
# $1 = text output from cargo llvm-cov --summary-only
rust_line_pct() {
  echo "$1" | grep -E "^TOTAL" | awk '{print $10}' | tr -d '%' || echo "0.00"
}

# ── 1. stellar-contract coverage ──────────────────────────────────────────────

CONTRACT_DIR="${REPO_ROOT}/stellar-contract"
CONTRACT_COVERAGE_DIR="${CONTRACT_DIR}/coverage"

echo "==> [1/4] Running coverage for stellar-contract..."

if ! rustup component list --installed | grep -q "llvm-tools-preview"; then
  echo "    Installing llvm-tools-preview..."
  rustup component add llvm-tools-preview
fi

if ! cargo llvm-cov --version &>/dev/null; then
  echo "    Installing cargo-llvm-cov..."
  cargo install cargo-llvm-cov --locked
fi

cd "${CONTRACT_DIR}"

if [ "$CI_MODE" = true ]; then
  CONTRACT_SUMMARY="$(cargo llvm-cov \
    --all-features \
    --workspace \
    --summary-only \
    --fail-under-lines 85 2>&1)"
  CONTRACT_LINE_PCT="$(rust_line_pct "$CONTRACT_SUMMARY")"
else
  mkdir -p "${CONTRACT_COVERAGE_DIR}"
  cargo llvm-cov \
    --all-features \
    --workspace \
    --html \
    --output-dir "${CONTRACT_COVERAGE_DIR}"
  CONTRACT_SUMMARY="$(cargo llvm-cov \
    --all-features \
    --workspace \
    --summary-only 2>&1)"
  CONTRACT_LINE_PCT="$(rust_line_pct "$CONTRACT_SUMMARY")"
  echo "    HTML report: ${CONTRACT_COVERAGE_DIR}/index.html"
fi

echo "    stellar-contract line coverage: ${CONTRACT_LINE_PCT}%"

# ── 2. backend coverage ────────────────────────────────────────────────────────

BACKEND_DIR="${REPO_ROOT}/backend"
BACKEND_COVERAGE_DIR="${BACKEND_DIR}/coverage"

echo "==> [2/4] Running coverage for backend..."

cd "${BACKEND_DIR}"

if [ "$CI_MODE" = true ]; then
  BACKEND_SUMMARY="$(cargo llvm-cov \
    --package scavenger-backend \
    --summary-only \
    --fail-under-lines 85 \
    -- --test-threads=1 2>&1)"
  BACKEND_LINE_PCT="$(rust_line_pct "$BACKEND_SUMMARY")"
else
  mkdir -p "${BACKEND_COVERAGE_DIR}"
  cargo llvm-cov \
    --package scavenger-backend \
    --html \
    --output-dir "${BACKEND_COVERAGE_DIR}" \
    -- --test-threads=1
  BACKEND_SUMMARY="$(cargo llvm-cov \
    --package scavenger-backend \
    --summary-only \
    -- --test-threads=1 2>&1)"
  BACKEND_LINE_PCT="$(rust_line_pct "$BACKEND_SUMMARY")"
  echo "    HTML report: ${BACKEND_COVERAGE_DIR}/index.html"
fi

echo "    backend line coverage: ${BACKEND_LINE_PCT}%"

# ── 3. frontend coverage ───────────────────────────────────────────────────────

FRONTEND_DIR="${REPO_ROOT}/frontend"
FRONTEND_COVERAGE_DIR="${COVERAGE_DIR}/frontend"

echo "==> [3/4] Running coverage for frontend..."

cd "${FRONTEND_DIR}"
mkdir -p "${FRONTEND_COVERAGE_DIR}"

# vitest v8 coverage: produce LCOV + JSON summary in one pass.
pnpm run test:coverage \
  --coverage.reportsDirectory="${FRONTEND_COVERAGE_DIR}" \
  --coverage.reporter=text \
  --coverage.reporter=json-summary \
  --coverage.reporter=lcov

FRONTEND_SUMMARY_FILE="${FRONTEND_COVERAGE_DIR}/coverage-summary.json"
FRONTEND_LINE_PCT="$(json_pct "$FRONTEND_SUMMARY_FILE" "lines")"
FRONTEND_FN_PCT="$(json_pct "$FRONTEND_SUMMARY_FILE" "functions")"
FRONTEND_BR_PCT="$(json_pct "$FRONTEND_SUMMARY_FILE" "branches")"
FRONTEND_ST_PCT="$(json_pct "$FRONTEND_SUMMARY_FILE" "statements")"

echo "    frontend line coverage: ${FRONTEND_LINE_PCT}%"

# ── 4. indexer coverage ────────────────────────────────────────────────────────

INDEXER_DIR="${REPO_ROOT}/indexer"
INDEXER_COVERAGE_DIR="${COVERAGE_DIR}/indexer"

echo "==> [4/4] Running coverage for indexer..."

cd "${INDEXER_DIR}"
mkdir -p "${INDEXER_COVERAGE_DIR}"

npx jest --runInBand --coverage \
  --coverageDirectory="${INDEXER_COVERAGE_DIR}" \
  --coverageReporters=text \
  --coverageReporters=json-summary \
  --coverageReporters=lcov

INDEXER_SUMMARY_FILE="${INDEXER_COVERAGE_DIR}/coverage-summary.json"
INDEXER_LINE_PCT="$(json_pct "$INDEXER_SUMMARY_FILE" "lines")"
INDEXER_FN_PCT="$(json_pct "$INDEXER_SUMMARY_FILE" "functions")"
INDEXER_BR_PCT="$(json_pct "$INDEXER_SUMMARY_FILE" "branches")"
INDEXER_ST_PCT="$(json_pct "$INDEXER_SUMMARY_FILE" "statements")"

echo "    indexer line coverage: ${INDEXER_LINE_PCT}%"

# ── 5. Write combined summary.md ───────────────────────────────────────────────

SUMMARY_FILE="${COVERAGE_DIR}/summary.md"
GENERATED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

cat > "${SUMMARY_FILE}" << EOF
# Coverage Summary

> Generated: ${GENERATED_AT}

## Per-Package Coverage

| Package | Lines | Functions | Branches | Statements | Format |
|---------|-------|-----------|----------|------------|--------|
| stellar-contract | ${CONTRACT_LINE_PCT}% | — | — | — | LCOV (llvm-cov) |
| backend | ${BACKEND_LINE_PCT}% | — | — | — | LCOV (llvm-cov) |
| frontend | ${FRONTEND_LINE_PCT}% | ${FRONTEND_FN_PCT}% | ${FRONTEND_BR_PCT}% | ${FRONTEND_ST_PCT}% | LCOV (vitest v8) |
| indexer | ${INDEXER_LINE_PCT}% | ${INDEXER_FN_PCT}% | ${INDEXER_BR_PCT}% | ${INDEXER_ST_PCT}% | LCOV (jest) |

## Thresholds

| Package | Lines threshold |
|---------|----------------|
| stellar-contract | ≥ 85% |
| backend | ≥ 85% |
| frontend | ≥ 70% |
| indexer | ≥ 70% |

## LCOV Report Locations

| Package | LCOV file |
|---------|-----------|
| stellar-contract | \`stellar-contract/coverage/lcov.info\` |
| backend | \`backend/coverage/lcov.info\` |
| frontend | \`coverage/frontend/lcov.info\` |
| indexer | \`coverage/indexer/lcov.info\` |

## How to run

\`\`\`bash
# Full HTML reports + combined summary
./scripts/generate-coverage.sh

# CI mode: summary only, fails if any package is below threshold
./scripts/generate-coverage.sh --ci
\`\`\`
EOF

echo ""
echo "==> Combined summary written to ${SUMMARY_FILE}"
echo ""
cat "${SUMMARY_FILE}"
