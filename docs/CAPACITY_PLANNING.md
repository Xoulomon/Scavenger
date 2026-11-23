# Automated Capacity Planning

## Overview

The capacity planning system automatically monitors resource utilization, forecasts future demand, and adjusts infrastructure capacity to maintain performance while optimizing costs.

## Capacity Model

The capacity model (`config/capacity-model.yaml`) defines:

- Resource limits and thresholds for compute, storage, and network
- Forecasting parameters (lookback period, growth rate, seasonality)
- Auto-scaling policies (target tracking, step scaling, scheduled scaling)
- Alert thresholds for warning and critical conditions

### Capacity Limits

| Resource         | Warning Threshold | Critical Threshold |
| ---------------- | ----------------- | ------------------ |
| ECS CPU          | 70%               | 85%                |
| ECS Memory       | 75%               | 90%                |
| RDS Storage      | 70%               | 85%                |
| RDS Connections  | 70%               | 85%                |
| ALB Request Rate | 8000 req/s        | -                  |

## Usage Forecasting

The forecasting system uses historical metrics to predict future capacity needs:

```bash
# Generate 30-day forecast
./scripts/capacity-forecast.sh

# Custom forecast period
DAYS_HISTORY=180 DAYS_FORECAST=60 ./scripts/capacity-forecast.sh
```

### Forecasting Model

- Algorithm: Linear regression with seasonal decomposition
- Lookback period: 90 days (configurable)
- Forecast horizon: 30 days (configurable)
- Seasonality: Daily, weekly, monthly patterns
- Anomaly detection: 2-sigma threshold

## Auto-scaling Rules

Multiple scaling policies work together to handle varying load patterns:

### Dynamic Scaling

- **CPU-based**: Target 60% utilization, scale out when sustained above
- **Memory-based**: Target 70% utilization, scale out when sustained above
- **Request-based**: Step scaling based on request count per target
- **VPA**: Vertical scaling adjusts resource requests/limits automatically

### Scheduled Scaling

- **Business hours**: Higher capacity (5-20 tasks)
- **Off hours**: Reduced capacity (2-5 tasks)
- **Weekends**: Minimum capacity (2-3 tasks)

## Capacity Alerts

Prometheus alerting rules monitor capacity metrics:

### Warning Alerts

- CPU > 70% for 5 minutes
- Memory > 75% for 5 minutes
- RDS storage < 20% free
- ALB request rate > 8000 req/s

### Critical Alerts

- CPU > 85% for 3 minutes
- Memory > 90% for 3 minutes
- RDS storage < 10% free

### Predictive Alerts

- Forecast predicts capacity breach within 24 hours

## Capacity Reports

Regular capacity reports provide visibility into utilization trends:

```bash
# Generate weekly capacity report
./scripts/capacity-report.sh

# Generate report for specific environment
ENVIRONMENT=staging ./scripts/capacity-report.sh
```

### Report Contents

- Compute utilization (CPU, Memory, Network I/O)
- Storage utilization (RDS, Redis, S3)
- Performance metrics (response time, throughput)
- Scaling activity summary
- Cost impact analysis
- Recommendations for capacity optimization

## Cost Optimization

Capacity planning integrates with cost optimization:

- Right-sizing recommendations based on utilization patterns
- Spot instance usage for flexible workloads
- Scheduled scaling for predictable traffic patterns
- Storage tier optimization for infrequently accessed data

## Best Practices

1. Monitor forecast accuracy monthly and adjust model parameters
2. Review capacity reports weekly during peak season
3. Test scaling policies during load testing
4. Maintain buffer capacity (20% headroom) for traffic spikes
5. Document scaling events and adjust thresholds as needed
