#!/usr/bin/env bash
# Scavngr Project Setup Verification Script.
# Canonical implementation — verify-setup.ps1 delegates here.
#
# Usage: ./scripts/verify-setup.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Verify the local Scavngr development environment:
  - Rust toolchain
  - WASM target (wasm32-unknown-unknown)
  - Soroban CLI
  - Required project files
  - Build and test pass

Exit codes:
  0  All checks passed (warnings may be present)
  1  A hard requirement is missing (e.g. Rust not installed)
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

echo "🔍 Verifying Scavngr Project Setup..."
echo ""

# Check Rust installation
echo "Checking Rust installation..."
if command -v rustc &> /dev/null; then
    echo "✅ Rust installed: $(rustc --version)"
else
    echo "❌ Rust not found. Install from https://rustup.rs"
    exit 1
fi

# Check WASM target
echo "Checking WASM target..."
if rustup target list | grep -q "wasm32-unknown-unknown (installed)"; then
    echo "✅ WASM target installed"
else
    echo "⚠️  WASM target not installed. Installing..."
    rustup target add wasm32-unknown-unknown
fi

# Check Soroban CLI
echo "Checking Soroban CLI..."
if command -v soroban &> /dev/null; then
    echo "✅ Soroban CLI installed: $(soroban --version)"
else
    echo "⚠️  Soroban CLI not found. Install with:"
    echo "   cargo install --locked soroban-cli --features opt"
fi

# Check project structure
echo ""
echo "Checking project structure..."
required_files=(
    "Cargo.toml"
    "stellar-contract/Cargo.toml"
    "stellar-contract/src/lib.rs"
    "stellar-contract/src/types.rs"
    ".gitignore"
    "soroban.toml"
    "README.md"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file missing"
    fi
done

# Try to build
echo ""
echo "Attempting to build project..."
if cargo build 2>&1 | grep -q "Finished"; then
    echo "✅ Project builds successfully"
else
    echo "⚠️  Build encountered issues (check output above)"
fi

# Try to run tests
echo ""
echo "Running tests..."
if cargo test 2>&1 | grep -q "test result: ok"; then
    echo "✅ All tests passed"
else
    echo "⚠️  Some tests failed (check output above)"
fi

echo ""
echo "✨ Setup verification complete!"
