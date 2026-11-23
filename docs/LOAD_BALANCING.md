# Load Balancing Configuration

## Overview

This document describes the load balancing setup for high availability and scalability.

## Architecture

### Application Load Balancer (ALB)

- **Type**: AWS Application Load Balancer
- **Listeners**: HTTP (redirect to HTTPS) and HTTPS
- **SSL/TLS**: AWS Certificate Manager (ACM)
- **Health Checks**: HTTP GET /health (30s interval, 2 healthy threshold)

### Target Groups

- **Protocol**: HTTP
- **Port**: 8080
- **Health Check Path**: /health
- **Stickiness**: Enabled (1 day duration)

## Load Balancing Algorithms

### Primary: Round-Robin

- Default algorithm for even distribution
- Suitable for stateless services

### Sticky Sessions

- Enabled for 86400 seconds (1 day)
- Uses AWSALB cookie
- Ensures user requests route to same target

## DDoS Protection

### AWS Shield Standard

- Automatic protection against common DDoS attacks
- Included with ALB

### AWS WAF (Optional)

- Rate limiting: 2000 requests per 5 minutes per IP
- IP reputation lists
- SQL injection and XSS protection

## SSL/TLS Configuration

### Certificate Management

- **Provider**: AWS Certificate Manager (ACM)
- **Auto-renewal**: Enabled
- **Policy**: ELBSecurityPolicy-TLS-1-2-2017-01

### Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

## Rate Limiting

### ALB Rate Limiting

- Max connections per target: 1000
- Connection timeout: 60 seconds
- Idle timeout: 60 seconds

### Application Level

- Implement token bucket algorithm
- Rate limit per user/IP: 100 requests/minute
- Burst capacity: 200 requests

## Monitoring

### Key Metrics

- **Request Count**: Total requests per minute
- **Target Response Time**: Average response time
- **HTTP 4xx/5xx Errors**: Error rate tracking
- **Active Connection Count**: Current connections
- **Processed Bytes**: Data throughput

### Alarms

- Response time > 1 second: Warning
- Error rate > 5%: Critical
- Unhealthy targets > 0: Warning
- Connection count > 80% capacity: Warning

## Failover & High Availability

### Multi-AZ Deployment

- Targets distributed across 3 availability zones
- Automatic failover on target failure
- Cross-zone load balancing enabled

### Health Check Configuration

- Interval: 30 seconds
- Timeout: 5 seconds
- Healthy threshold: 2 consecutive checks
- Unhealthy threshold: 2 consecutive checks

## Scaling

### Auto-Scaling Policy

- **Metric**: CPU Utilization
- **Target**: 70%
- **Scale-up**: 100% increase, 30 second cooldown
- **Scale-down**: 50% decrease, 60 second cooldown
- **Min Capacity**: 3 tasks
- **Max Capacity**: 10 tasks

## Cloudflare Integration (Optional)

### Benefits

- Global CDN
- Additional DDoS protection
- Caching layer
- WAF capabilities

### Configuration

```
DNS: CNAME to ALB DNS name
SSL/TLS: Full (strict)
Caching: Cache static assets
```

## Testing

### Load Testing

```bash
# Using Apache Bench
ab -n 10000 -c 100 https://api.scavenger.com/health

# Using wrk
wrk -t12 -c400 -d30s https://api.scavenger.com/health
```

### Failover Testing

1. Terminate one target
2. Verify ALB removes from rotation
3. Confirm traffic routes to healthy targets
4. Monitor response times and error rates
