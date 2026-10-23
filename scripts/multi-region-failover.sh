#!/usr/bin/env bash
# Multi-region failover automation.
#
# Usage: ./scripts/multi-region-failover.sh [region] [action] [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [region] [action] [--help]

Perform or query multi-region Route53 failover for the Scavenger platform.

Arguments:
  region   Target region for failover (default: reads from env)
  action   Action to perform: status | failover | failback (default: status)

Environment:
  PRIMARY_REGION     Primary AWS region    (default: us-east-1)
  SECONDARY_REGION   Secondary AWS region  (default: us-east-2)
  DOMAIN             Application domain    (default: scavenger.app)
  AWS_PROFILE        AWS CLI profile       (default: default)
EOF
  exit 0
fi

REGION="${1:-}"
ACTION="${2:-status}"

PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-east-2}"
DOMAIN="${DOMAIN:-scavenger.app}"
PROFILE="${AWS_PROFILE:-default}"

failover_to_secondary() {
  echo "Initiating failover from $PRIMARY_REGION to $SECONDARY_REGION..."
  
  echo "Checking secondary region health..."
  aws route53 health-check-status \
    --health-check-id "$(aws route53 list-health-checks --query "HealthChecks[?HealthCheckConfig.FullyQualifiedDomainName=='$SECONDARY_REGION-scavenger.$DOMAIN'].Id" --output text --profile "$PROFILE")" \
    --profile "$PROFILE"
  
  echo "Updating Route53 failover records..."
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN" --query "HostedZones[0].Id" --output text --profile "$PROFILE")" \
    --change-batch '{
      "Changes": [
        {
          "Action": "UPSERT",
          "ResourceRecordSet": {
            "Name": "'"$DOMAIN"'",
            "Type": "A",
            "SetIdentifier": "primary",
            "Failover": "PRIMARY",
            "HealthCheckId": "'"$(aws route53 list-health-checks --query "HealthChecks[?HealthCheckConfig.FullyQualifiedDomainName=='$PRIMARY_REGION-scavenger.$DOMAIN'].Id" --output text --profile "$PROFILE")"'",
            "AliasTarget": {
              "HostedZoneId": "'"$(aws elbv2 describe-load-balancers --names scavenger-primary --query "LoadBalancers[0].CanonicalHostedZoneId" --output text --profile "$PROFILE" --region "$PRIMARY_REGION")"'",
              "DNSName": "'"$(aws elbv2 describe-load-balancers --names scavenger-primary --query "LoadBalancers[0].DNSName" --output text --profile "$PROFILE" --region "$PRIMARY_REGION")"'",
              "EvaluateTargetHealth": true
            },
            "Failover": "PRIMARY",
            "SetIdentifier": "primary"
          }
        },
        {
          "Action": "UPSERT",
          "ResourceRecordSet": {
            "Name": "'"$DOMAIN"'",
            "Type": "A",
            "SetIdentifier": "secondary",
            "Failover": "SECONDARY",
            "HealthCheckId": "'"$(aws route53 list-health-checks --query "HealthChecks[?HealthCheckConfig.FullyQualifiedDomainName=='$SECONDARY_REGION-scavenger.$DOMAIN'].Id" --output text --profile "$PROFILE")"'",
            "AliasTarget": {
              "HostedZoneId": "'"$(aws elbv2 describe-load-balancers --names scavenger-secondary --query "LoadBalancers[0].CanonicalHostedZoneId" --output text --profile "$PROFILE" --region "$SECONDARY_REGION")"'",
              "DNSName": "'"$(aws elbv2 describe-load-balancers --names scavenger-secondary --query "LoadBalancers[0].DNSName" --output text --profile "$PROFILE" --region "$SECONDARY_REGION")"'",
              "EvaluateTargetHealth": true
            },
            "Failover": "SECONDARY",
            "SetIdentifier": "secondary"
          }
        }
      ]
    }' \
    --profile "$PROFILE"
  
  echo "Failover to $SECONDARY_REGION complete"
}

failover_to_primary() {
  echo "Failing back to $PRIMARY_REGION..."
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN" --query "HostedZones[0].Id" --output text --profile "$PROFILE")" \
    --change-batch '{
      "Changes": [
        {
          "Action": "UPSERT",
          "ResourceRecordSet": {
            "Name": "'"$DOMAIN"'",
            "Type": "A",
            "SetIdentifier": "primary",
            "Failover": "PRIMARY",
            "AliasTarget": {
              "HostedZoneId": "'"$(aws elbv2 describe-load-balancers --names scavenger-primary --query "LoadBalancers[0].CanonicalHostedZoneId" --output text --profile "$PROFILE" --region "$PRIMARY_REGION")"'",
              "DNSName": "'"$(aws elbv2 describe-load-balancers --names scavenger-primary --query "LoadBalancers[0].DNSName" --output text --profile "$PROFILE" --region "$PRIMARY_REGION")"'",
              "EvaluateTargetHealth": true
            }
          }
        }
      ]
    }' \
    --profile "$PROFILE"
  
  echo "Failback to $PRIMARY_REGION complete"
}

status() {
  echo "Multi-region deployment status:"
  echo "Primary region: $PRIMARY_REGION"
  echo "Secondary region: $SECONDARY_REGION"
  echo ""
  
  echo "Route53 health checks:"
  aws route53 list-health-checks --query "HealthChecks[?contains(HealthCheckConfig.FullyQualifiedDomainName, 'scavenger')].[Id,HealthCheckConfig.FullyQualifiedDomainName,HealthCheckConfig.Type]" --output table --profile "$PROFILE"
  
  echo ""
  echo "VPC Peering connections:"
  aws ec2 describe-vpc-peering-connections --filters "Name=tag:Project,Values=scavenger" --query "VpcPeeringConnections[*].[VpcPeeringConnectionId,Status.Code]" --output table --profile "$PROFILE" --region "$PRIMARY_REGION"
}

case "$ACTION" in
  failover)
    if [ "${REGION}" = "secondary" ]; then
      failover_to_secondary
    elif [ "${REGION}" = "primary" ]; then
      failover_to_primary
    else
      echo "Usage: $0 <region> failover"
      echo "Region must be 'primary' or 'secondary'"
      exit 1
    fi
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {status|failover}"
    exit 1
    ;;
esac
