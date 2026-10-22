# Multi-Region Architecture

> Decision record: [ADR-0012](adr/0012-multi-region-active-passive.md).


## Overview
The Scavenger platform is deployed across multiple AWS regions to ensure high availability and disaster recovery. This document describes the architecture, failover mechanisms, and operational procedures.

## Architecture Diagram

```
                    +-------------------+
                    |   Route53 DNS     |
                    | (Failover Routing)|
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
    +---------v----------+       +---------v----------+
    |  Primary Region    |       | Secondary Region   |
    |  (us-east-1)       |       | (us-east-2)        |
    |                    |       |                    |
    |  +-- ALB ---------+|       |+-- ALB ----------+ |
    |  | ECS (Fargate)  ||       || ECS (Fargate)   | |
    |  | RDS (Primary)  ||       || RDS (Standby)   | |
    |  | ElastiCache    ||       || ElastiCache     | |
    |  | S3 (Primary)   |+------>+| S3 (Replica)    | |
    |  +----------------+|       |+-----------------+ |
    +--------------------+       +--------------------+
```

## Components

### Route53 DNS Failover
- Primary region serves traffic under normal conditions
- Health checks monitor primary region endpoints every 30 seconds
- On failure (3 consecutive failures), Route53 automatically routes traffic to secondary region
- Latency-based routing can be enabled for geo-distributed deployments

### Cross-Region VPC Peering
- Direct encrypted connectivity between region VPCs
- Enables cross-region database replication and service communication
- Route tables updated to route traffic between regions

### Data Replication
- **RDS**: Cross-region read replica with automatic failover capability
- **S3**: Cross-region replication with versioning enabled
- **ECR**: Container images replicated to secondary region
- **ElastiCache**: Cross-region backup and restore

### Health Checks
Each region exposes health endpoints:
- `/health` - Overall service health
- `/health/db` - Database connectivity
- `/health/redis` - Cache connectivity
- `/ready` - Readiness probe

## Failover Process

### Automatic Failover
1. Route53 health check detects primary region failure
2. After 3 consecutive failures, Route53 marks primary as unhealthy
3. DNS TTL expires and clients resolve to secondary region
4. Secondary region ALB serves traffic
5. Secondary RDS promoted to primary if needed

### Manual Failover
```bash
# Trigger failover to secondary
scripts/multi-region-failover.sh secondary failover

# Check status
scripts/region-health-check.sh

# Failback to primary
scripts/multi-region-failover.sh primary failover
```

## RTO and RPO

| Metric | Target |
|--------|--------|
| RTO (DNS failover) | < 5 minutes |
| RTO (full failover) | < 15 minutes |
| RPO (database) | < 1 second |
| RPO (storage) | < 15 minutes |

## Operational Procedures

See [MULTI_REGION_OPERATIONS.md](MULTI_REGION_OPERATIONS.md) for detailed operational runbooks.
