# Terraform Infrastructure as Code Documentation

## Overview
This directory contains Terraform configurations for deploying the Scavenger platform on AWS.

## Structure
```
terraform/
├── main.tf                 # Root module configuration
├── variables.tf            # Input variables
├── environments/           # Environment-specific configurations
│   ├── prod.tfvars
│   ├── staging.tfvars
│   └── dev.tfvars
└── modules/               # Reusable modules
    ├── vpc/              # VPC and networking
    ├── rds/              # Database
    ├── ecs/              # Container orchestration
    ├── alb/              # Load balancing
    └── monitoring/       # CloudWatch monitoring
```

## Prerequisites
- Terraform >= 1.0
- AWS CLI configured with credentials
- S3 bucket for state management
- DynamoDB table for state locking

## State Management
State is stored in S3 with DynamoDB locking:
```bash
# Create S3 bucket
aws s3 mb s3://scavenger-terraform-state --region us-east-1

# Create DynamoDB table
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
```

## Deployment

### Initialize
```bash
terraform init
```

### Plan
```bash
terraform plan -var-file=environments/prod.tfvars
```

### Apply
```bash
terraform apply -var-file=environments/prod.tfvars
```

### Destroy
```bash
terraform destroy -var-file=environments/prod.tfvars
```

## Pre-commit Hooks
Install pre-commit hooks for validation:
```bash
pre-commit install
```

Hooks validate:
- Terraform formatting
- Terraform validation
- Security scanning with tfsec
- Cost estimation with infracost

## Environment Variable Matrix

All variables default to safe dev values in `variables.tf`. Each environment
only overrides what differs.

| Variable | Default | dev | staging | prod |
|---|---|---|---|---|
| `environment` | (required) | `dev` | `staging` | `prod` |
| `vpc_cidr` | `10.0.0.0/16` | `10.0.0.0/16` | `10.1.0.0/16` | `10.2.0.0/16` |
| `db_instance_class` | `db.t3.micro` | same | `db.t3.small` | `db.r6i.large` |
| `db_allocated_storage` | `20` | same | `100` | `500` |
| `db_backup_retention` | `7` | same | `14` | `90` |
| `db_multi_az` | `false` | same | same | `true` |
| `db_enhanced_backup` | `false` | same | same | `true` |
| `ecs_desired_count` | `1` | same | `2` | `3` |
| `ecs_min_capacity` | `1` | same | `2` | `2` |
| `ecs_max_capacity` | `3` | `1` | `4` | `10` |
| `enable_load_balancer` | `false` | same | `true` | `true` |
| `log_retention_days` | `7` | same | `14` | `90` |
| `enable_autoscaling` | `false` | same | same | `true` |
| `autoscaling_target_cpu` | `70` | same | same | `70` |

### State isolation

The S3 backend key is **not** set in `main.tf` (Terraform forbids variables in
backend blocks). Supply it per environment at init time:

```bash
# dev
terraform init -backend-config="key=dev/terraform.tfstate"

# staging
terraform init -backend-config="key=staging/terraform.tfstate"

# prod
terraform init -backend-config="key=prod/terraform.tfstate"
