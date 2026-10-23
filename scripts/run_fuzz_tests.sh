#!/usr/bin/env bash
# Run the full fuzzing test suite for the Scavenger smart contract.
#
# Usage: ./scripts/run_fuzz_tests.sh [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [--help]

Run the three-stage property/fuzz test suite via cargo test.

Environment:
  PROPTEST_CASES   Number of test cases to generate (default: 1000)
EOF
  exit 0
fi

CASES=${PROPTEST_CASES:-1000}
echo "Running fuzzing suite with PROPTEST_CASES=$CASES"
echo "================================================"

echo ""
echo "[1/3] Running comprehensive fuzzing suite..."
PROPTEST_CASES=$CASES cargo test --package stellar-scavngr-contract --test fuzz_comprehensive -- --nocapture 2>&1 | tee /tmp/fuzz_results.log

echo ""
echo "[2/3] Running regression tests..."
cargo test --package stellar-scavngr-contract --test fuzz_regression -- --nocapture 2>&1 | tee -a /tmp/fuzz_results.log

echo ""
echo "[3/3] Running existing fuzz tests..."
PROPTEST_CASES=$CASES cargo test --package stellar-scavngr-contract fuzz_ -- --nocapture 2>&1 | tee -a /tmp/fuzz_results.log

echo ""
echo "================================================"
echo "Fuzzing complete. Full results in /tmp/fuzz_results.log"
