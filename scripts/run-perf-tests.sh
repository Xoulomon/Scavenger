#!/bin/bash

# Master Performance Testing Script for Scavenger
# Orchestrates k6 performance tests with various profiles
# Usage: ./run-perf-tests.sh [OPTIONS]
#
# Options:
#   -p, --profile PROFILE    Run specific profile: smoke|load|stress|spike|soak (default: smoke)
#   -a, --all                Run all profiles sequentially
#   -b, --base-url URL       Base URL for API (default: http://localhost:8000/api)
#   -c, --contract ID        Contract ID (default: CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4)
#   -o, --output DIR         Output results to directory
#   -j, --json               Output JSON results
#   -h, --help               Show this help message

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
RESET='\033[0m'

# Defaults
PROFILE="smoke"
BASE_URL="${BASE_URL:-http://localhost:8000/api}"
CONTRACT_ID="${CONTRACT_ID:-CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4}"
OUTPUT_DIR=""
JSON_OUTPUT=false
RUN_ALL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--profile)
            PROFILE="$2"
            shift 2
            ;;
        -a|--all)
            RUN_ALL=true
            shift
            ;;
        -b|--base-url)
            BASE_URL="$2"
            shift 2
            ;;
        -c|--contract)
            CONTRACT_ID="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -j|--json)
            JSON_OUTPUT=true
            shift
            ;;
        -h|--help)
            echo "Performance Testing Script for Scavenger"
            echo ""
            echo "Usage: ./run-perf-tests.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -p, --profile PROFILE    Run specific profile: smoke|load|stress|spike|soak"
            echo "  -a, --all                Run all profiles sequentially"
            echo "  -b, --base-url URL       Base URL for API (default: http://localhost:8000/api)"
            echo "  -c, --contract ID        Contract ID"
            echo "  -o, --output DIR         Output results to directory"
            echo "  -j, --json               Output JSON results"
            echo "  -h, --help               Show this help message"
            echo ""
            echo "Profiles:"
            echo "  smoke      - Quick sanity check (1 user, 50 seconds)"
            echo "  load       - Steady load test (100 users, 6 minutes)"
            echo "  stress     - Breaking point test (1000-10000 users, 15 minutes)"
            echo "  spike      - Traffic burst test (1000 spike, 6 minutes)"
            echo "  soak       - Endurance test (500 users, 40 minutes)"
            echo ""
            echo "Examples:"
            echo "  ./run-perf-tests.sh                          # Run smoke test"
            echo "  ./run-perf-tests.sh --profile load           # Run load test"
            echo "  ./run-perf-tests.sh --all                    # Run all profiles"
            echo "  BASE_URL=https://api.example.com ./run-perf-tests.sh -p load"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate profile
validate_profile() {
    case "$1" in
        smoke|load|stress|spike|soak)
            return 0
            ;;
        *)
            echo -e "${RED}Error: Unknown profile '$1'${RESET}"
            echo "Valid profiles: smoke, load, stress, spike, soak"
            exit 1
            ;;
    esac
}

# Check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}Error: k6 is not installed${RESET}"
        echo "Install k6: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
}

# Run a specific test profile
run_profile() {
    local profile=$1
    local script="performance/k6-${profile}.js"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local result_file=""

    if [ ! -f "$script" ]; then
        echo -e "${RED}Error: Test script not found: $script${RESET}"
        exit 1
    fi

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${BLUE}Running ${profile^} Profile${RESET}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
    echo "Configuration:"
    echo "  Base URL: $BASE_URL"
    echo "  Contract: $CONTRACT_ID"
    echo "  Script: $script"
    echo ""

    # Prepare output file if requested
    if [ -n "$OUTPUT_DIR" ]; then
        mkdir -p "$OUTPUT_DIR"
        if [ "$JSON_OUTPUT" = true ]; then
            result_file="${OUTPUT_DIR}/${profile}_${timestamp}.json"
            echo "  Output: $result_file"
            echo ""
        fi
    fi

    # Set environment variables
    export BASE_URL
    export CONTRACT_ID

    # Run test
    local start_time=$(date +%s)

    if [ -n "$result_file" ]; then
        k6 run --out "json=${result_file}" "$script"
    else
        k6 run "$script"
    fi

    local exit_code=$?
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ ${profile^} test passed${RESET}"
    else
        echo -e "${RED}✗ ${profile^} test failed (exit code: $exit_code)${RESET}"
        return $exit_code
    fi

    echo "Duration: ${duration}s"
    echo ""
}

# Main execution
check_k6

echo -e "${BLUE}═══════════════════════════════════════════════════${RESET}"
echo -e "${BLUE}Scavenger Performance Testing Suite${RESET}"
echo -e "${BLUE}═══════════════════════════════════════════════════${RESET}"
echo ""

if [ "$RUN_ALL" = true ]; then
    echo -e "${YELLOW}Running all profiles in sequence...${RESET}"
    echo ""

    profiles=("smoke" "load" "stress" "spike" "soak")
    total=${#profiles[@]}
    failed=0

    for i in "${!profiles[@]}"; do
        profile="${profiles[$i]}"
        profile_num=$((i + 1))
        echo -e "${YELLOW}[${profile_num}/${total}] Running ${profile}...${RESET}"
        echo ""

        if ! run_profile "$profile"; then
            failed=$((failed + 1))
        fi

        # Add delay between profiles
        if [ $i -lt $((total - 1)) ]; then
            echo -e "${YELLOW}Waiting 30s before next profile...${RESET}"
            sleep 30
        fi
    done

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════${RESET}"
    echo -e "${BLUE}All Profiles Complete${RESET}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${RESET}"
    echo ""
    echo "Results:"
    echo "  Total: ${#profiles[@]}"
    echo "  Passed: $((total - failed))"
    echo "  Failed: $failed"

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed${RESET}"
        exit 0
    else
        echo -e "${RED}✗ $failed test(s) failed${RESET}"
        exit 1
    fi
else
    validate_profile "$PROFILE"
    run_profile "$PROFILE"
    exit $?
fi
