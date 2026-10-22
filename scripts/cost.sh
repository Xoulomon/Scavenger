#!/usr/bin/env bash
#
# cost.sh - Unified cloud cost tool
#
# Consolidates the former cost-analysis.sh, cost-report.sh,
# cost-allocation.sh and cost-optimization-recommendations.sh scripts
# into a single subcommand-based tool with shared argument parsing,
# error handling and output conventions.
#
# Subcommands:
#   analysis         Analyze cloud cost data and print a summary
#   report           Generate a cost report
#   allocation       Show cost allocation breakdown
#   recommendations  Show cost optimization recommendations
#
# Usage:
#   scripts/cost.sh <subcommand> [options]
#   scripts/cost.sh --help
#   scripts/cost.sh <subcommand> --help
#
# Environment variables:
#   AWS_REGION            AWS region (default: us-east-1)
#   AWS_PROFILE           AWS CLI profile to use (optional)
#   ENVIRONMENT           Deployment environment (default: dev)
#   COST_ANALYSIS_DAYS    Lookback window for `analysis` (default: 30)
#   COST_REPORT_DAYS      Lookback window for `report` (default: 30)
#   REPORT_DIR            Output directory for `report` (default: reports/cost)
#   OUTPUT_DIR            Output directory for `allocation` (default: reports/cost)
#
set -euo pipefail

SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# ---------------------------------------------------------------------------
# Shared configuration
# ---------------------------------------------------------------------------
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
COST_ANALYSIS_DAYS="${COST_ANALYSIS_DAYS:-30}"
COST_REPORT_DAYS="${COST_REPORT_DAYS:-30}"
REPORT_DIR="${REPORT_DIR:-reports/cost}"
OUTPUT_DIR="${OUTPUT_DIR:-reports/cost}"

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" >&2
}

error() {
    echo "ERROR: $*" >&2
}

die() {
    error "$*"
    exit 1
}

require_command() {
    local cmd="$1"
    command -v "$cmd" >/dev/null 2>&1 || die "Required command not found: $cmd"
}

# Build the common AWS CLI argument list (region + optional profile).
aws_args() {
    local args=(--region "$AWS_REGION")
    if [[ -n "${AWS_PROFILE:-}" ]]; then
        args+=(--profile "$AWS_PROFILE")
    fi
    printf '%s\n' "${args[@]}"
}

# Run an AWS CLI command with shared region/profile arguments.
aws_cli() {
    local -a args=()
    while IFS= read -r line; do
        args+=("$line")
    done < <(aws_args)
    aws "${args[@]}" "$@"
}

# Validate that a value is a positive integer.
validate_days() {
    local value="$1"
    local name="$2"
    [[ "$value" =~ ^[0-9]+$ ]] && (( value > 0 )) \
        || die "$name must be a positive integer (got: '$value')"
}

# Compute the start date for a lookback window (YYYY-MM-DD).
start_date() {
    local days="$1"
    date -u -d "$days days ago" '+%Y-%m-%d' 2>/dev/null \
        || date -u -v-"${days}"d '+%Y-%m-%d'
}

# Compute today's date (YYYY-MM-DD).
end_date() {
    date -u '+%Y-%m-%d'
}

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
    cat <<EOF
Usage: $SCRIPT_NAME <subcommand> [options]

Unified cloud cost tool. Reads cloud cost data via the AWS CLI and prints
summaries, reports, allocation breakdowns and optimization recommendations.

Subcommands:
  analysis         Analyze cloud cost data and print a summary
  report           Generate a cost report
  allocation       Show cost allocation breakdown
  recommendations  Show cost optimization recommendations

Global options:
  -h, --help       Show this help message and exit

Run '$SCRIPT_NAME <subcommand> --help' for subcommand-specific options.

Environment variables:
  AWS_REGION            AWS region (default: us-east-1)
  AWS_PROFILE           AWS CLI profile to use (optional)
  ENVIRONMENT           Deployment environment (default: dev)
  COST_ANALYSIS_DAYS    Lookback window for 'analysis' (default: 30)
  COST_REPORT_DAYS      Lookback window for 'report' (default: 30)
  REPORT_DIR            Output directory for 'report' (default: reports/cost)
  OUTPUT_DIR            Output directory for 'allocation' (default: reports/cost)

Examples:
  $SCRIPT_NAME analysis
  $SCRIPT_NAME analysis --days 7
  $SCRIPT_NAME report --days 14
  $SCRIPT_NAME allocation
  $SCRIPT_NAME recommendations
EOF
}

# ---------------------------------------------------------------------------
# Subcommand: analysis
# (formerly scripts/cost-analysis.sh)
# ---------------------------------------------------------------------------
usage_analysis() {
    cat <<EOF
Usage: $SCRIPT_NAME analysis [options]

Analyze cloud cost data and print a summary.

Options:
  -d, --days <n>   Lookback window in days (default: \$COST_ANALYSIS_DAYS or 30)
  -h, --help       Show this help message and exit

Environment:
  AWS_REGION, AWS_PROFILE, ENVIRONMENT, COST_ANALYSIS_DAYS
EOF
}

cmd_analysis() {
    local days="$COST_ANALYSIS_DAYS"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -d|--days)
                [[ $# -ge 2 ]] || die "Option $1 requires a value"
                days="$2"
                shift 2
                ;;
            -h|--help)
                usage_analysis
                return 0
                ;;
            *)
                die "Unknown option for 'analysis': $1"
                ;;
        esac
    done

    validate_days "$days" "--days"
    require_command aws

    local start end
    start="$(start_date "$days")"
    end="$(end_date)"

    log "Analyzing costs for environment '$ENVIRONMENT' in '$AWS_REGION' ($start to $end)"

    local output
    output="$(aws_cli ce get-cost-and-usage \
        --time-period "Start=$start,End=$end" \
        --granularity MONTHLY \
        --metrics UnblendedCost \
        --group-by Type=DIMENSION,Key=SERVICE \
        --query 'ResultsByTime[].Groups[].[Keys[0],Metrics.UnblendedCost.Amount]' \
        --output text)" || die "Failed to retrieve cost data"

    echo "Cost Analysis"
    echo "============="
    echo "Environment: $ENVIRONMENT"
    echo "Region:      $AWS_REGION"
    echo "Period:      $start to $end ($days days)"
    echo

    if [[ -z "$output" ]]; then
        echo "No cost data found for the specified period."
        return 0
    fi

    printf '%-40s %12s\n' "SERVICE" "COST (USD)"
    printf '%-40s %12s\n' "----------------------------------------" "------------"

    local total=0
    while IFS=$'\t' read -r service cost; do
        [[ -z "$service" ]] && continue
        printf '%-40s %12s\n' "$service" "$cost"
        total="$(awk -v a="$total" -v b="$cost" 'BEGIN { printf "%.2f", a + b }')"
    done <<< "$output"

    printf '%-40s %12s\n' "----------------------------------------" "------------"
    printf '%-40s %12s\n' "TOTAL" "$total"
}

# ---------------------------------------------------------------------------
# Subcommand: report
# (formerly scripts/cost-report.sh)
# ---------------------------------------------------------------------------
usage_report() {
    cat <<EOF
Usage: $SCRIPT_NAME report [options]

Generate a cost report and write it to \$REPORT_DIR.

Options:
  -d, --days <n>   Lookback window in days (default: \$COST_REPORT_DAYS or 30)
  -o, --output <dir>  Output directory (default: \$REPORT_DIR or reports/cost)
  -h, --help       Show this help message and exit

Environment:
  AWS_REGION, AWS_PROFILE, ENVIRONMENT, COST_REPORT_DAYS, REPORT_DIR
EOF
}

cmd_report() {
    local days="$COST_REPORT_DAYS"
    local out_dir="$REPORT_DIR"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -d|--days)
                [[ $# -ge 2 ]] || die "Option $1 requires a value"
                days="$2"
                shift 2
                ;;
            -o|--output)
                [[ $# -ge 2 ]] || die "Option $1 requires a value"
                out_dir="$2"
                shift 2
                ;;
            -h|--help)
                usage_report
                return 0
                ;;
            *)
                die "Unknown option for 'report': $1"
                ;;
        esac
    done

    validate_days "$days" "--days"
    require_command aws

    local start end
    start="$(start_date "$days")"
    end="$(end_date)"

    mkdir -p "$out_dir"
    local report_file="$out_dir/cost-report-${ENVIRONMENT}-$(date -u '+%Y%m%d').txt"

    log "Generating cost report for environment '$ENVIRONMENT' in '$AWS_REGION' ($start to $end)"

    local output
    output="$(aws_cli ce get-cost-and-usage \
        --time-period "Start=$start,End=$end" \
        --granularity DAILY \
        --metrics UnblendedCost \
        --query 'ResultsByTime[].[TimePeriod.Start,Total.UnblendedCost.Amount]' \
        --output text)" || die "Failed to retrieve cost data"

    {
        echo "Cost Report"
        echo "==========="
        echo "Environment: $ENVIRONMENT"
        echo "Region:      $AWS_REGION"
        echo "Period:      $start to $end ($days days)"
        echo "Generated:   $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
        echo

        if [[ -z "$output" ]]; then
            echo "No cost data found for the specified period."
        else
            printf '%-15s %12s\n' "DATE" "COST (USD)"
            printf '%-15s %12s\n' "---------------" "------------"

            local total=0
            while IFS=$'\t' read -r day cost; do
                [[ -z "$day" ]] && continue
                printf '%-15s %12s\n' "$day" "$cost"
                total="$(awk -v a="$total" -v b="$cost" 'BEGIN { printf "%.2f", a + b }')"
            done <<< "$output"

            printf '%-15s %12s\n' "---------------" "------------"
            printf '%-15s %12s\n' "TOTAL" "$total"
        fi
    } | tee "$report_file"

    log "Report written to $report_file"
}

# ---------------------------------------------------------------------------
# Subcommand: allocation
# (formerly scripts/cost-allocation.sh)
# ---------------------------------------------------------------------------
usage_allocation() {
    cat <<EOF
Usage: $SCRIPT_NAME allocation [options]

Show cost allocation breakdown by tag.

Options:
  -t, --tag <key>  Tag key to group by (default: Environment)
  -o, --output <dir>  Output directory (default: \$OUTPUT_DIR or reports/cost)
  -h, --help       Show this help message and exit

Environment:
  AWS_REGION, AWS_PROFILE, ENVIRONMENT, OUTPUT_DIR
EOF
}

cmd_allocation() {
    local tag_key="Environment"
    local out_dir="$OUTPUT_DIR"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -t|--tag)
                [[ $# -ge 2 ]] || die "Option $1 requires a value"
                tag_key="$2"
                shift 2
                ;;
            -o|--output)
                [[ $# -ge 2 ]] || die "Option $1 requires a value"
                out_dir="$2"
                shift 2
                ;;
            -h|--help)
                usage_allocation
                return 0
                ;;
            *)
                die "Unknown option for 'allocation': $1"
                ;;
        esac
    done

    require_command aws

    local start end
    start="$(start_date 30)"
    end="$(end_date)"

    mkdir -p "$out_dir"
    local allocation_file="$out_dir/cost-allocation-${ENVIRONMENT}-$(date -u '+%Y%m%d').txt"

    log "Computing cost allocation by tag '$tag_key' in '$AWS_REGION' ($start to $end)"

    local output
    output="$(aws_cli ce get-cost-and-usage \
        --time-period "Start=$start,End=$end" \
        --granularity MONTHLY \
        --metrics UnblendedCost \
        --group-by "Type=TAG,Key=$tag_key" \
        --query 'ResultsByTime[].Groups[].[Keys[0],Metrics.UnblendedCost.Amount]' \
        --output text)" || die "Failed to retrieve cost allocation data"

    {
        echo "Cost Allocation"
        echo "==============="
        echo "Environment: $ENVIRONMENT"
        echo "Region:      $AWS_REGION"
        echo "Tag key:     $tag_key"
        echo "Period:      $start to $end"
        echo

        if [[ -z "$output" ]]; then
            echo "No cost allocation data found for the specified period."
        else
            printf '%-40s %12s\n' "$tag_key" "COST (USD)"
            printf '%-40s %12s\n' "----------------------------------------" "------------"

            local total=0
            while IFS=$'\t' read -r tag_value cost; do
                [[ -z "$tag_value" ]] && continue
                printf '%-40s %12s\n' "$tag_value" "$cost"
                total="$(awk -v a="$total" -v b="$cost" 'BEGIN { printf "%.2f", a + b }')"
            done <<< "$output"

            printf '%-40s %12s\n' "----------------------------------------" "------------"
            printf '%-40s %12s\n' "TOTAL" "$total"
        fi
    } | tee "$allocation_file"

    log "Allocation report written to $allocation_file"
}

# ---------------------------------------------------------------------------
# Subcommand: recommendations
# (formerly scripts/cost-optimization-recommendations.sh)
# ---------------------------------------------------------------------------
usage_recommendations() {
    cat <<EOF
Usage: $SCRIPT_NAME recommendations [options]

Show cost optimization recommendations.

Options:
  -h, --help       Show this help message and exit

Environment:
  AWS_REGION, AWS_PROFILE, ENVIRONMENT
EOF
}

cmd_recommendations() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage_recommendations
                return 0
                ;;
            *)
                die "Unknown option for 'recommendations': $1"
                ;;
        esac
    done

    require_command aws

    log "Retrieving cost optimization recommendations for environment '$ENVIRONMENT' in '$AWS_REGION'"

    local output
    output="$(aws_cli ce get-cost-and-usage \
        --time-period "Start=$(start_date 30),End=$(end_date)" \
        --granularity MONTHLY \
        --metrics UnblendedCost \
        --group-by Type=DIMENSION,Key=SERVICE \
        --query 'ResultsByTime[].Groups[].[Keys[0],Metrics.UnblendedCost.Amount]' \
        --output text)" || die "Failed to retrieve cost data for recommendations"

    echo "Cost Optimization Recommendations"
    echo "================================="
    echo "Environment: $ENVIRONMENT"
    echo "Region:      $AWS_REGION"
    echo

    if [[ -z "$output" ]]; then
        echo "No cost data found; unable to generate recommendations."
        return 0
    fi

    printf '%-40s %12s %s\n' "SERVICE" "COST (USD)" "RECOMMENDATION"
    printf '%-40s %12s %s\n' "----------------------------------------" "------------" "----------------------------------------"

    while IFS=$'\t' read -r service cost; do
        [[ -z "$service" ]] && continue
        local recommendation="Review usage; consider rightsizing or reserved capacity"
        if awk -v c="$cost" 'BEGIN { exit !(c >= 100) }'; then
            recommendation="High spend: evaluate savings plans or reserved instances"
        elif awk -v c="$cost" 'BEGIN { exit !(c >= 10) }'; then
            recommendation="Moderate spend: review resource utilization"
        fi
        printf '%-40s %12s %s\n' "$service" "$cost" "$recommendation"
    done <<< "$output"
}

# ---------------------------------------------------------------------------
# Main dispatch
# ---------------------------------------------------------------------------
main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 1
    fi

    local subcommand="$1"
    shift

    case "$subcommand" in
        analysis)
            cmd_analysis "$@"
            ;;
        report)
            cmd_report "$@"
            ;;
        allocation)
            cmd_allocation "$@"
            ;;
        recommendations)
            cmd_recommendations "$@"
            ;;
        -h|--help|help)
            usage
            ;;
        *)
            error "Unknown subcommand: $subcommand"
            echo
            usage
            exit 1
            ;;
    esac
}

main "$@"