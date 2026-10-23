#!/usr/bin/env bash
# Build and optimize WASM for Soroban deployment.
# Canonical implementation — build-wasm.ps1 delegates here.
#
# Usage: ./scripts/build-wasm.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Build the Scavngr Soroban contract to WASM and optimise it with the Soroban CLI.

Requirements:
  - cargo (Rust toolchain with wasm32-unknown-unknown target)
  - soroban CLI

Output:
  target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

echo "🔨 Building Scavngr Contract..."

# Build WASM
echo "Building WASM..."
cargo build --target wasm32-unknown-unknown --release

# Optimize WASM
echo "Optimizing WASM..."
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

echo "✅ Build complete!"
echo "📦 Optimized WASM: target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm"
