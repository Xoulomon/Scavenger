# Container Registry (ECR) — #482

## Overview

Three private ECR repositories are provisioned via Terraform:

| Repository | URI pattern                                                    |
| ---------- | -------------------------------------------------------------- |
| backend    | `<account>.dkr.ecr.us-east-1.amazonaws.com/scavenger/backend`  |
| indexer    | `<account>.dkr.ecr.us-east-1.amazonaws.com/scavenger/indexer`  |
| frontend   | `<account>.dkr.ecr.us-east-1.amazonaws.com/scavenger/frontend` |

## Features

- **Image scanning** — ECR Enhanced Scanning runs on every push. Critical findings trigger an SNS alert via EventBridge.
- **Image signing** — Cosign keyless signing (Sigstore) is applied in CI after every push. Verify with `cosign verify --certificate-identity-regexp="github.com/Xoulomon/Scavenger" <image>`.
- **Retention** — Untagged images expire after 1 day. Tagged images (`v*`, `sha-*`) are capped at 10 per repo.
- **Encryption** — All images are encrypted at rest with a dedicated KMS key (`alias/scavenger-ecr-<env>`).
- **Access control** — Push is restricted to the CI IAM role; pull is restricted to the ECS task role.

## Terraform

```bash
cd terraform
terraform init
terraform apply -var-file=environments/prod.tfvars \
  -var="ci_role_arn=arn:aws:iam::ACCOUNT:role/scavenger-ci" \
  -var="ecs_task_role_arn=arn:aws:iam::ACCOUNT:role/scavenger-ecs-task" \
  -var="alerts_sns_arn=arn:aws:sns:us-east-1:ACCOUNT:scavenger-alerts"
```

## CI/CD Workflow

The workflow `.github/workflows/ecr-build-push.yml` triggers on pushes to `main` and version tags.

Required GitHub secrets:

| Secret            | Description                          |
| ----------------- | ------------------------------------ |
| `AWS_ACCOUNT_ID`  | AWS account number                   |
| `AWS_CI_ROLE_ARN` | IAM role ARN for OIDC authentication |

The workflow:

1. Authenticates to AWS via OIDC (no long-lived credentials).
2. Builds each service in parallel using Docker Buildx with GitHub Actions layer cache.
3. Tags images as `sha-<short-sha>` on branch pushes, `v<tag>` on version tags.
4. Signs the pushed image digest with Cosign keyless signing.
5. Runs a Trivy scan and fails the build on CRITICAL/HIGH findings.

## Manual push (emergency)

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

docker build -t scavenger/backend ./backend
docker tag scavenger/backend <account>.dkr.ecr.us-east-1.amazonaws.com/scavenger/backend:manual
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/scavenger/backend:manual
```
