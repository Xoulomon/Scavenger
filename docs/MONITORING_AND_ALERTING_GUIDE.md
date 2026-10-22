# Monitoring and Alerting Guide

## Overview

This guide documents the monitoring setup, key metrics, dashboard configuration, and alerting procedures for the Scavenger platform.

## Monitoring Architecture

### Components

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and management
- **Node Exporter**: System metrics collection
- **Application Metrics**: Custom contract and business metrics

### Deployment

Monitoring stack is deployed via Docker Compose:

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

## Key Metrics

### Contract Metrics

| Metric | Description | Type | Alert Threshold |
|--------|-------------|------|-----------------|
| `scavenger_participants_total` | Total registered participants | Gauge | N/A |
| `scavenger_waste_submitted_total` | Total waste submissions | Counter | N/A |
| `scavenger_waste_verified_total` | Total verified waste | Counter | N/A |
| `scavenger_incentives_active` | Active incentives count | Gauge | < 5 |
| `scavenger_tokens_distributed_total` | Total tokens distributed | Counter | N/A |
| `scavenger_contract_calls_total` | Total contract calls | Counter | N/A |
| `scavenger_contract_errors_total` | Total contract errors | Counter | > 10/min |
| `scavenger_gas_used_total` | Total gas consumed | Counter | N/A |

### System Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `node_cpu_seconds_total` | CPU usage | > 80% |
| `node_memory_MemAvailable_bytes` | Available memory | < 20% |
| `node_disk_avail_bytes` | Disk space | < 10% |
| `node_network_receive_bytes_total` | Network in | N/A |
| `node_network_transmit_bytes_total` | Network out | N/A |

### Application Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `http_requests_total` | HTTP requests | N/A |
| `http_request_duration_seconds` | Request latency | > 5s (p95) |
| `http_errors_total` | HTTP errors | > 5% error rate |
| `database_connections_active` | Active DB connections | > 80 |
| `database_query_duration_seconds` | Query latency | > 1s (p95) |

## Dashboard Setup

### Accessing Grafana

1. Navigate to `http://localhost:3000`
2. Default credentials: `admin` / `admin`
3. Change password on first login

### Creating Dashboards

#### Dashboard 1: Contract Overview

**Panels:**
- Participants growth (time series)
- Waste submissions (gauge)
- Active incentives (stat)
- Token distribution (time series)
- Contract error rate (graph)

#### Dashboard 2: System Health

**Panels:**
- CPU usage (graph)
- Memory usage (gauge)
- Disk usage (gauge)
- Network traffic (graph)
- System uptime (stat)

#### Dashboard 3: Performance

**Panels:**
- Request latency (heatmap)
- Error rate (graph)
- Throughput (graph)
- Database query performance (graph)
- Gas usage trends (time series)

### Dashboard JSON Export

Export dashboards for version control:

```bash
# Export dashboard
curl -H "Authorization: Bearer $GRAFANA_API_TOKEN" \
  http://localhost:3000/api/dashboards/db/contract-overview \
  | jq '.dashboard' > dashboard-contract-overview.json

# Import dashboard
curl -X POST -H "Authorization: Bearer $GRAFANA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @dashboard-contract-overview.json \
  http://localhost:3000/api/dashboards/db
```

## Alert Configuration

### Alert Rules

Prometheus alert rules live under `config/prometheus/rules/`, grouped by domain
(e.g. `contracts.yml`, `system.yml`, `application.yml`). This directory is the
single source of truth for alert definitions — do not add alert rules to other
files under `config/`. Validate changes with:

```bash
promtool check rules config/prometheus/rules/*.yml
```

The canonical alerts are:

```yaml
groups:
  - name: scavenger_contracts
    interval: 30s
    rules:
      - alert: ScavengerContractErrorRateHigh
        expr: rate(scavenger_contract_errors_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High contract error rate"
          description: "Error rate: {{ $value }}"

      - alert: ScavengerActiveIncentivesLow
        expr: scavenger_incentives_active < 5
        for: 10m
        annotations:
          summary: "Low active incentives"
          description: "Active incentives: {{ $value }}"

  - name: scavenger_system
    interval: 30s
    rules:
      - alert: ScavengerCPUUsageHigh
        expr: node_cpu_seconds_total > 0.8
        for: 5m
        annotations:
          summary: "High CPU usage"
          description: "CPU: {{ $value }}%"

      - alert: ScavengerDiskSpaceLow
        expr: node_disk_avail_bytes / node_disk_size_bytes < 0.1
        for: 5m
        annotations:
          summary: "Low disk space"
          description: "Available: {{ $value }}%"

  - name: scavenger_application
    interval: 30s
    rules:
      - alert: ScavengerRequestLatencyHigh
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 5
        for: 5m
        annotations:
          summary: "High request latency"
          description: "P95 latency: {{ $value }}s"
```

### Alert Thresholds

| Alert | Threshold | Duration | Severity |
|-------|-----------|----------|----------|
| Contract Error Rate | > 10/min | 5m | Critical |
| Low Incentives | < 5 active | 10m | Warning |
| High CPU | > 80% | 5m | Warning |
| Low Memory | < 20% | 5m | Warning |
| Low Disk | < 10% | 5m | Critical |
| High Latency | P95 > 5s | 5m | Warning |
| DB Connection Pool | > 80 | 5m | Warning |

## AlertManager Configuration

AlertManager routes alerts to notification channels:

```yaml
# config/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  receiver: 'default'
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h

  routes:
    - match:
        severity: critical
      receiver: 'critical'
      continue: true

    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts'

  - name: 'critical'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#critical-alerts'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'

  - name: 'warning'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#warnings'
```

## Incident Response Procedures

### Alert Triage

1. **Receive Alert**: Alert triggered in AlertManager
2. **Classify**: Determine severity (Critical/Warning/Info)
3. **Investigate**: Check dashboards and logs
4. **Assign**: Route to on-call engineer

### Critical Alert Response

**High Contract Error Rate:**
1. Check contract logs: `docker logs scavenger-contract`
2. Verify network connectivity
3. Check Stellar network status
4. Restart contract if needed: `docker restart scavenger-contract`
5. Escalate if errors persist

**Low Disk Space:**
1. Check disk usage: `df -h`
2. Identify large files: `du -sh /*`
3. Archive old logs: `tar -czf logs-archive-$(date +%Y%m%d).tar.gz logs/`
4. Clean up: `rm -rf logs/*.log.old`
5. Monitor recovery

**High Latency:**
1. Check database performance: `EXPLAIN ANALYZE` on slow queries
2. Monitor CPU/memory: `top`, `free -h`
3. Check network: `iftop`, `nethogs`
4. Scale if needed or optimize queries

### Runbook for Common Issues

#### Issue: Contract Deployment Failed

**Symptoms:**
- Contract calls failing
- Error rate spike
- Participants unable to register

**Resolution:**
1. Check contract logs: `docker logs scavenger-contract`
2. Verify contract address: `soroban contract info --id <CONTRACT_ID>`
3. Redeploy if necessary:
   ```bash
   soroban contract deploy \
     --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
     --source deployer \
     --network testnet
   ```
4. Update contract ID in configuration
5. Restart application services

#### Issue: Database Connection Pool Exhausted

**Symptoms:**
- Slow queries
- Connection timeout errors
- High latency

**Resolution:**
1. Check active connections: `SELECT count(*) FROM pg_stat_activity;`
2. Identify long-running queries: `SELECT * FROM pg_stat_statements ORDER BY mean_time DESC;`
3. Kill idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';`
4. Increase pool size if needed
5. Optimize slow queries

#### Issue: Memory Leak

**Symptoms:**
- Increasing memory usage over time
- OOM killer events
- Performance degradation

**Resolution:**
1. Monitor memory: `watch -n 1 'free -h'`
2. Check process memory: `ps aux | grep scavenger`
3. Enable memory profiling
4. Identify leaking component
5. Restart service if critical
6. Deploy fix

## SLA Documentation

### Service Level Objectives

| Metric | Target | Measurement |
|--------|--------|-------------|
| Availability | 99.9% | Monthly uptime |
| Latency (P95) | < 500ms | API response time |
| Error Rate | < 0.1% | Failed requests |
| Contract Success | > 99% | Successful transactions |

### Maintenance Windows

- **Scheduled**: Sundays 2-4 AM UTC
- **Emergency**: As needed with notification
- **Notification**: 24 hours advance notice

### Escalation Policy

1. **Level 1**: On-call engineer (15 min response)
2. **Level 2**: Senior engineer (30 min response)
3. **Level 3**: Engineering lead (1 hour response)

## Monitoring Best Practices

1. **Alert Fatigue**: Tune thresholds to reduce false positives
2. **Retention**: Keep metrics for 15 days, logs for 30 days
3. **Testing**: Test alerts monthly
4. **Documentation**: Keep runbooks updated
5. **Review**: Weekly alert review and optimization
6. **Automation**: Automate remediation where possible
7. **Capacity Planning**: Monitor trends for scaling needs

## Tools and Commands

### Prometheus Queries

```promql
# Contract error rate
rate(scavenger_contract_errors_total[5m])

# Waste submission rate
rate(scavenger_waste_submitted_total[1h])

# Average gas per transaction
rate(scavenger_gas_used_total[1h]) / rate(scavenger_contract_calls_total[1h])

# Request latency percentiles
histogram_quantile(0.95, http_request_duration_seconds)
```

### Useful Commands

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Query Prometheus
curl 'http://localhost:9090/api/v1/query?query=up'

# Check AlertManager status
curl http://localhost:9093/api/v1/status

# View active alerts
curl http://localhost:9093/api/v1/alerts

# Reload Prometheus config
curl -X POST http://localhost:9090/-/reload
```

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/overview/)
- [Stellar Monitoring](https://developers.stellar.org/docs/learn/monitoring)
