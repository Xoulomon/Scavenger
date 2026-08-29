#!/usr/bin/env bash
# generate-coverage.sh — Issue #1113
#
# Generates an HTML + summary coverage report for stellar-contract using
# cargo-llvm-cov.  Installs prerequisites if missing.
#
# Usage:
#   ./scripts/generate-coverage.sh          # HTML report in stellar-contract/coverage/
#   ./scripts/generate-coverage.sh --ci     # Summary only, fails if < 85 % lines
#
# Requirements: Rust stable toolchain, rustup

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTRACT_DIR="${REPO_ROOT}/stellar-contract"
COVERAGE_DIR="${CONTRACT_DIR}/coverage"
CI_MODE=false

for arg in "$@"; do
  case "$arg" in
    --ci) CI_MODE=true ;;
  esac
done

echo "==> Checking prerequisites..."

# Ensure llvm-tools-preview is installed
if ! rustup component list --installed | grep -q "llvm-tools-preview"; then
  echo "    Installing llvm-tools-preview..."
  rustup component add llvm-tools-preview
fi

# Ensure cargo-llvm-cov is installed
if ! cargo llvm-cov --version &>/dev/null; then
  echo "    Installing cargo-llvm-cov..."
  cargo install cargo-llvm-cov --locked
fi

echo "==> Running coverage for stellar-contract..."

cd "${CONTRACT_DIR}"

if [ "$CI_MODE" = true ]; then
  # CI: summary only, fail if below threshold
  cargo llvm-cov \
    --all-features \
    --workspace \
    --summary-only \
    --fail-under-lines 85
else
  # Developer: full HTML report
  mkdir -p "${COVERAGE_DIR}"
  cargo llvm-cov \
    --all-features \
    --workspace \
    --html \
    --output-dir "${COVERAGE_DIR}"

  echo ""
  echo "==> Coverage report written to ${COVERAGE_DIR}/index.html"
  echo ""

  # Also print the summary table
  cargo llvm-cov \
    --all-features \
    --workspace \
    --summary-only
fi
