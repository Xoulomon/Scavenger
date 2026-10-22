#!/usr/bin/env bash
# Analyze current AWS costs for the Scavenger project.
#
# Usage: ./scripts/cost-analysis.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Query AWS Cost Explorer and print a cost breakdown for the Scavenger project.

Environment:
  AWS_REGION           AWS region       (default: us-east-1)
  ENVIRONMENT          Environment tag  (default: prod)
  COST_ANALYSIS_DAYS   Look-back period (default: 30)
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
DAYS="${COST_ANALYSIS_DAYS:-30}"

END_DATE=$(date +%Y-%m-%d)
START_DATE=$(date -d "-${DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-"${DAYS}"d +%Y-%m-%d)

echo "======================================"
echo " Scavenger Cost Analysis"
echo " Period: $START_DATE → $END_DATE"
echo " Environment: $ENVIRONMENT"
echo "======================================"
echo ""

# Total cost for the project tag
echo "--- Total Cost (Project=scavenger) ---"
aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --filter '{"Tags":{"Key":"Project","Values":["scavenger"]}}' \
  --metrics "UnblendedCost" \
  --query 'ResultsByTime[*].{Period:TimePeriod.Start,Cost:Total.UnblendedCost.Amount,Unit:Total.UnblendedCost.Unit}' \
  --output table \
  --region "$REGION"

echo ""
echo "--- Cost Breakdown by Service ---"
# SC2016: The single-quoted JMESPath expression uses backtick literals that are
# AWS JMESPath syntax, not Bash command substitutions — disabling the warning.
# shellcheck disable=SC2016
aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --filter '{"Tags":{"Key":"Project","Values":["scavenger"]}}' \
  --metrics "UnblendedCost" \
  --group-by '[{"Type":"DIMENSION","Key":"SERVICE"}]' \
  --query 'ResultsByTime[0].Groups[?Metrics.UnblendedCost.Amount>`0.01`] | sort_by(@, &Metrics.UnblendedCost.Amount) | reverse(@) | [*].{Service:Keys[0],Cost:Metrics.UnblendedCost.Amount}' \
  --output table \
  --region "$REGION"

echo ""
echo "--- ECS Spot vs On-Demand Split ---"
aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --filter '{"And":[{"Tags":{"Key":"Project","Values":["scavenger"]}},{"Dimensions":{"Key":"SERVICE","Values":["Amazon Elastic Container Service"]}}]}' \
  --metrics "UnblendedCost" \
  --group-by '[{"Type":"DIMENSION","Key":"PURCHASE_TYPE"}]' \
  --query 'ResultsByTime[0].Groups[*].{PurchaseType:Keys[0],Cost:Metrics.UnblendedCost.Amount}' \
  --output table \
  --region "$REGION"

echo ""
echo "--- RDS Cost ---"
aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --filter '{"And":[{"Tags":{"Key":"Project","Values":["scavenger"]}},{"Dimensions":{"Key":"SERVICE","Values":["Amazon Relational Database Service"]}}]}' \
  --metrics "UnblendedCost" \
  --query 'ResultsByTime[*].{Period:TimePeriod.Start,Cost:Total.UnblendedCost.Amount}' \
  --output table \
  --region "$REGION"

echo ""
echo "--- Budget Status ---"
# shellcheck disable=SC2016
aws budgets describe-budgets \
  --account-id "$(aws sts get-caller-identity --query Account --output text)" \
  --query 'Budgets[?contains(BudgetName,`scavenger`)].{Name:BudgetName,Limit:BudgetLimit.Amount,Actual:CalculatedSpend.ActualSpend.Amount,Forecasted:CalculatedSpend.ForecastedSpend.Amount}' \
  --output table \
  --region "$REGION"

echo ""
echo "Cost analysis complete."
