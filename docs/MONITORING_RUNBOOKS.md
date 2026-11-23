# Monitoring Documentation

## Stack Overview

Scavenger uses a comprehensive monitoring stack:

- **Prometheus**: Metrics collection and time-series storage
- **Grafana**: Visualization and dashboarding
- **ELK Stack**: Centralized logging (Elasticsearch, Logstash, Kibana)
- **Jaeger**: Distributed tracing
- **AlertManager**: Alert management and routing

## Key Metrics Monitored

### Application Metrics

- HTTP request rate, latency (p50, p95, p99)
- Error rates and types
- Service availability
- Transaction success rates

### Infrastructure Metrics

- Container CPU and memory usage
- Disk I/O and space
- Network I/O
- Pod restart counts

### Business Metrics

- Waste collected (kg)
- Participants count
- Rewards distributed
- Supply chain efficiency

### Blockchain Metrics

- Transaction success rate
- Gas usage
- Smart contract calls
- Stellar network sync status

## Accessing Monitoring Tools

### Prometheus

- URL: `http://localhost:9090`
- Query language: PromQL
- Data retention: 30 days by default

### Grafana

- URL: `http://localhost:3000`
- Default credentials: admin/admin
- Pre-built dashboards for key metrics

### Kibana

- URL: `http://localhost:5601`
- Full-text log search and analysis

### Jaeger

- URL: `http://localhost:16686`
- Trace visualization and analysis

## Alert Rules

See `alerting-rules.yml` for configured alerts:

- Critical errors and service downtime
- Resource exhaustion (CPU, memory, disk)
- SLO violations (< 99% availability)
- Database connection issues
- High API latency (> 1s p95)
- Anomaly detection

## Deployment

### Docker Compose

Full monitoring stack:

```bash
docker-compose -f docker-compose.monitoring.yml -f docker-compose.observability.yml up
```

### Kubernetes

Deploy monitoring with Helm:

```bash
helm install scavenger-monitoring ./k8s/monitoring
```

## Best Practices

1. **Set meaningful alert thresholds** - Base on SLOs
2. **Monitor from outside** - External checks catch infrastructure issues
3. **Log structured data** - JSON format for easy parsing
4. **Trace critical paths** - Focus on user-facing operations
5. **Regular alert reviews** - Remove noisy, low-value alerts
6. **Maintain runbooks** - Document incident response procedures

## SLA Tracking

Target metrics:

- 99.9% availability
- < 200ms p95 latency
- < 1% error rate

Violations are automatically alerted.

## On-Call Runbooks

### Service Down Alert

1. Check pod status: `kubectl get pods -n scavenger`
2. View logs: `kubectl logs deployment/scavenger-backend`
3. Check resource limits: `kubectl describe deployment`
4. Restart if needed: `kubectl rollout restart deployment/scavenger-backend`

### High Error Rate Alert

1. Check error types in logs
2. Monitor related service dependencies
3. Check recent code deployments
4. Analyze error patterns in Kibana

### High Resource Usage Alert

1. Identify resource-hungry pods
2. Check if spike is temporary or sustained
3. Consider horizontal scaling
4. Review resource requests/limits

## Performance Tuning

- **Prometheus retention**: Adjust based on storage capacity
- **Scrape intervals**: Reduce for more granular data (higher cost)
- **Alert evaluation**: Shorter intervals = faster detection (higher CPU)
- **Log retention**: Archive old logs to S3 for cost savings
