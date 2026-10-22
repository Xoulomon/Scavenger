#!/usr/bin/env bash
# Generate a cost report for the Scavenger project.
#
# Usage: ./scripts/cost-report.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Query AWS Cost Explorer, print a cost report to stdout, and write a Markdown
summary to REPORT_DIR.

Environment:
  ENVIRONMENT       Environment tag    (default: prod)
  COST_REPORT_DAYS  Look-back period   (default: 30)
  AWS_PROFILE       AWS CLI profile    (default: default)
  REPORT_DIR        Output directory   (default: /tmp/cost-reports)
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

ENVIRONMENT="${ENVIRONMENT:-prod}"
DAYS="${COST_REPORT_DAYS:-30}"
PROFILE="${AWS_PROFILE:-default}"
REPORT_DIR="${REPORT_DIR:-/tmp/cost-reports}"

mkdir -p "$REPORT_DIR"

END_DATE=$(date +%Y-%m-%d)
START_DATE=$(date -d "-${DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-"${DAYS}"d +%Y-%m-%d)

echo "=== Scavenger Cost Report ==="
echo "Period: $START_DATE to $END_DATE"
echo "Environment: $ENVIRONMENT"
echo ""

get_cost_and_usage() {
  local granularity="$1"
  local group_by="$2"
  local filter="$3"
  local query="$4"

  aws ce get-cost-and-usage \
    --time-period "Start=$START_DATE,End=$END_DATE" \
    --granularity "$granularity" \
    --filter "$filter" \
    --metrics "UnblendedCost" \
    --group-by "$group_by" \
    --query "$query" \
    --output json \
    --profile "$PROFILE" 2>/dev/null || echo "[]"
}

PROJECT_FILTER='{"Tags":{"Key":"Project","Values":["scavenger"]}}'

echo "--- Total Cost ---"
TOTAL_COST=$(aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --filter "$PROJECT_FILTER" \
  --metrics "UnblendedCost" \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
  --output text \
  --profile "$PROFILE" 2>/dev/null || echo "0")
echo "Total spend: \$${TOTAL_COST}"

echo ""
echo "--- Cost by Service ---"
echo "Service | Cost" > "${REPORT_DIR}/cost-by-service-${END_DATE}.csv"
# SC2016: single-quoted JMESPath backtick literals are not Bash expansions.
# shellcheck disable=SC2016
aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --filter "$PROJECT_FILTER" \
  --metrics "UnblendedCost" \
  --group-by '[{"Type":"DIMENSION","Key":"SERVICE"}]' \
  --query 'ResultsByTime[0].Groups[?Metrics.UnblendedCost.Amount>`0.01`] | sort_by(@, &Metrics.UnblendedCost.Amount) | reverse(@) | [*].{Service:Keys[0],Cost:Metrics.UnblendedCost.Amount}' \
  --output table \
  --profile "$PROFILE" 2>/dev/null || echo "No data available"

echo ""
echo "--- Cost by Environment ---"
# shellcheck disable=SC2016
aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --filter "$PROJECT_FILTER" \
  --metrics "UnblendedCost" \
  --group-by '[{"Type":"TAG","Key":"Environment"}]' \
  --query 'ResultsByTime[0].Groups[?Metrics.UnblendedCost.Amount>`0.01`] | [*].{Environment:Keys[0],Cost:Metrics.UnblendedCost.Amount}' \
  --output table \
  --profile "$PROFILE" 2>/dev/null || echo "No data available"

echo ""
echo "--- Daily Cost Trend (Last 14 days) ---"
aws ce get-cost-and-usage \
  --time-period "Start=$(date -d "-14 days" +%Y-%m-%d 2>/dev/null || date -v-14d +%Y-%m-%d),End=$END_DATE" \
  --granularity DAILY \
  --filter "$PROJECT_FILTER" \
  --metrics "UnblendedCost" \
  --query 'ResultsByTime[*].{Date:TimePeriod.Start,Cost:Total.UnblendedCost.Amount}' \
  --output table \
  --profile "$PROFILE" 2>/dev/null || echo "No data available"

echo ""
echo "--- Budget Status ---"
# shellcheck disable=SC2016
aws budgets describe-budgets \
  --account-id "$(aws sts get-caller-identity --query Account --output text --profile "$PROFILE")" \
  --query 'Budgets[?contains(BudgetName,`scavenger`)].{Name:BudgetName,Limit:BudgetLimit.Amount,Actual:CalculatedSpend.ActualSpend.Amount,Forecasted:CalculatedSpend.ForecastedSpend.Amount}' \
  --output table \
  --profile "$PROFILE" 2>/dev/null || echo "No budget data available"

generate_markdown_report() {
  cat > "${REPORT_DIR}/cost-report-${END_DATE}.md" << REPORTEOF
# Cost Report - $END_DATE

## Period
$START_DATE to $END_DATE

## Summary
- **Total Spend**: \$$TOTAL_COST
- **Environment**: $ENVIRONMENT

## Recommendations

REPORTEOF
  echo ""
  echo "Report saved to ${REPORT_DIR}/cost-report-${END_DATE}.md"
}

generate_markdown_report
echo ""
echo "=== Cost Report Complete ==="
