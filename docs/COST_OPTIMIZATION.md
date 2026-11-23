# Cost Optimization — #483

## Overview

The `terraform/modules/cost_optimization` module implements four cost-saving mechanisms.

## 1. ECS Auto-scaling

Two target-tracking policies are attached to the ECS service:

| Policy | Target | Scale-out cooldown | Scale-in cooldown |
| ------ | ------ | ------------------ | ----------------- |
| CPU    | 70%    | 60 s               | 300 s             |
| Memory | 80%    | 60 s               | 300 s             |

Capacity bounds are controlled by `ecs_min_capacity` / `ecs_max_capacity` variables.

## 2. Spot Instances

A Spot capacity provider is registered on the ECS cluster with a 3:1 Spot-to-Fargate weight. At least one Fargate task is always kept as a baseline (`base = 1`) to avoid full Spot interruption.

Expected savings: **60–70%** vs on-demand for non-baseline tasks.

## 3. Budget Alerts

A monthly AWS Budget is created filtered by the `Project=scavenger` tag:

- **80% actual** → email alert
- **100% forecasted** → email alert

Configure recipients via the `budget_alert_emails` variable. Default limit is `$200/month` (override with `monthly_budget_usd`).

## 4. RDS Auto-stop (non-prod)

For `dev` and `staging` environments, EventBridge rules stop the RDS instance at **20:00 UTC** and restart it at **07:00 UTC**, saving ~11 hours of compute per day (~46% reduction).

This is automatically disabled for `prod` (guarded by `var.environment != "prod"`).

## Terraform variables

| Variable              | Default  | Description                  |
| --------------------- | -------- | ---------------------------- |
| `ecs_min_capacity`    | `1`      | Minimum ECS task count       |
| `ecs_max_capacity`    | `10`     | Maximum ECS task count       |
| `spot_asg_arn`        | required | ARN of the Spot ASG          |
| `monthly_budget_usd`  | `"200"`  | Monthly budget limit         |
| `budget_alert_emails` | `[]`     | Alert recipients             |
| `scheduler_role_arn`  | required | IAM role for EventBridge→SSM |

## Cost monitoring

Use AWS Cost Explorer with the `Project=scavenger` tag filter to track spend per environment. Enable the **Cost Anomaly Detection** monitor on the same tag for automated anomaly alerts.
