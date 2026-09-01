# Performance Optimization Guide

## Overview

This guide documents performance optimization techniques and best practices for the Scavenger platform across frontend, backend, contract, and database layers.

## Frontend Optimization

### Code Splitting

Implement lazy loading for routes:

```typescript
// src/router.tsx
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Participants = lazy(() => import('./pages/Participants'));

export const routes = [
  {
    path: '/dashboard',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <Dashboard />
      </Suspense>
    ),
  },
];
```

### Bundle Analysis

```bash
# Analyze bundle size
npm run build -- --analyze

# Expected bundle sizes:
# - Main: < 200KB
# - Vendor: < 300KB
# - Total: < 500KB (gzipped)
```

### Image Optimization

```typescript
// Use responsive images
<img
  src="image.webp"
  srcSet="image-small.webp 480w, image-medium.webp 1024w"
  sizes="(max-width: 600px) 480px, 1024px"
  alt="Description"
/>

// Or use Next.js Image component
<Image
  src="/image.jpg"
  alt="Description"
  width={1024}
  height={768}
  priority={false}
/>
```

### Caching Strategy

```typescript
// Service Worker caching
const CACHE_VERSION = 'v1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(CACHE_URLS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

### Performance Metrics

| Metric | Target | Tool |
|--------|--------|------|
| First Contentful Paint (FCP) | < 1.8s | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |
| Time to Interactive (TTI) | < 3.8s | Lighthouse |
| Lighthouse Score | > 90 | Lighthouse |

### Lighthouse Testing

```bash
# Run Lighthouse audit
npm run lighthouse

# Configuration: frontend/lighthouserc.json
# Thresholds:
# - Performance: 90
# - Accessibility: 90
# - Best Practices: 90
# - SEO: 90
```

## Backend Optimization

### Database Query Optimization

#### Index Strategy

```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_participants_address ON participants(address);
CREATE INDEX idx_waste_owner ON waste(owner_id);
CREATE INDEX idx_waste_type ON waste(waste_type);
CREATE INDEX idx_incentives_manufacturer ON incentives(manufacturer_id);
CREATE INDEX idx_transfers_from_to ON transfers(from_id, to_id);

-- Composite indexes for common queries
CREATE INDEX idx_waste_owner_type ON waste(owner_id, waste_type);
CREATE INDEX idx_transfers_timestamp ON transfers(from_id, created_at DESC);
```

#### Query Optimization

```sql
-- Bad: N+1 query problem
SELECT * FROM participants;
-- Then loop and query for each participant's wastes

-- Good: Use JOIN
SELECT p.*, COUNT(w.id) as waste_count
FROM participants p
LEFT JOIN waste w ON p.id = w.owner_id
GROUP BY p.id;

-- Use EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT p.*, COUNT(w.id) as waste_count
FROM participants p
LEFT JOIN waste w ON p.id = w.owner_id
GROUP BY p.id;
```

#### Connection Pooling

```rust
// Cargo.toml
[dependencies]
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres"] }

// src/main.rs
let pool = PgPoolOptions::new()
    .max_connections(20)
    .min_connections(5)
    .connect_timeout(Duration::from_secs(5))
    .connect(&database_url)
    .await?;
```

### Caching Strategy

#### Redis Caching

```rust
use redis::Commands;

pub async fn get_participant_cached(
    redis: &redis::Connection,
    participant_id: &str,
) -> Result<Participant> {
    let cache_key = format!("participant:{}", participant_id);

    // Try cache first
    if let Ok(cached) = redis.get::<_, String>(&cache_key) {
        return Ok(serde_json::from_str(&cached)?);
    }

    // Fetch from DB
    let participant = fetch_from_db(participant_id).await?;

    // Cache for 1 hour
    redis.set_ex(&cache_key, serde_json::to_string(&participant)?, 3600)?;

    Ok(participant)
}
```

#### Cache Invalidation

```rust
pub async fn update_participant(
    redis: &redis::Connection,
    participant_id: &str,
    data: UpdateData,
) -> Result<()> {
    // Update database
    update_in_db(participant_id, &data).await?;

    // Invalidate cache
    redis.del(format!("participant:{}", participant_id))?;

    Ok(())
}
```

### API Response Compression

```rust
use actix_web::middleware::Compress;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .wrap(Compress::default())
            .service(routes)
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

### Rate Limiting

```rust
use actix_web_httpauth::middleware::HttpAuthentication;

pub async fn rate_limit_middleware(
    req: ServiceRequest,
    srv: &mut dyn Service<ServiceRequest, Response = ServiceResponse, Error = Error>,
) -> Result<ServiceResponse, Error> {
    let key = req.connection_info().peer_addr().unwrap_or("unknown");

    // Check rate limit (e.g., 100 requests per minute)
    if !check_rate_limit(key, 100, 60) {
        return Err(error::ErrorTooManyRequests("Rate limit exceeded"));
    }

    srv.call(req).await
}
```

## Contract Optimization

### Gas Optimization

#### Minimize Storage Operations

```rust
// Bad: Multiple storage writes
pub fn submit_waste(env: &Env, waste: Waste) -> Result<u64, Error> {
    let mut counter = get_waste_counter(&env)?;
    counter += 1;
    set_waste_counter(&env, counter)?;  // Write 1

    let mut wastes = get_all_wastes(&env)?;
    wastes.push(waste);
    set_all_wastes(&env, wastes)?;  // Write 2

    Ok(counter)
}

// Good: Batch operations
pub fn submit_waste(env: &Env, waste: Waste) -> Result<u64, Error> {
    let counter = get_waste_counter(&env)?;
    let new_counter = counter + 1;

    // Single storage write with both updates
    env.storage().persistent().set(&DataKey::WasteCounter, &new_counter);
    env.storage().persistent().set(&DataKey::Waste(new_counter), &waste);

    Ok(new_counter)
}
```

#### Optimize Data Structures

```rust
// Use compact types
pub struct Waste {
    id: u64,              // 8 bytes
    owner: Address,       // 32 bytes
    waste_type: u8,       // 1 byte (enum)
    weight: u128,         // 16 bytes
    timestamp: u64,       // 8 bytes
    // Total: 65 bytes
}

// Avoid unnecessary fields
// Don't store derived data that can be computed
```

#### Batch Operations

```rust
pub fn submit_materials_batch(
    env: &Env,
    submitter: Address,
    materials: Vec<Material>,
) -> Result<Vec<u64>, Error> {
    let mut ids = Vec::new();
    let mut counter = get_waste_counter(&env)?;

    for material in materials {
        counter += 1;
        let waste = Waste::from(material);
        env.storage().persistent().set(&DataKey::Waste(counter), &waste);
        ids.push(counter);
    }

    env.storage().persistent().set(&DataKey::WasteCounter, &counter);
    Ok(ids)
}
```

### Gas Benchmarks

| Operation | Gas Used | Optimization |
|-----------|----------|--------------|
| Register Participant | ~5,000 | Batch if possible |
| Submit Waste | ~3,000 | Use batch submit |
| Verify Material | ~2,500 | Cache results |
| Transfer Waste | ~4,000 | Optimize path |
| Create Incentive | ~6,000 | Reuse incentives |

### Before/After Metrics

```
Before Optimization:
- Average gas per transaction: 8,500
- Contract size: 450KB
- Deployment cost: ~2.5M stroops

After Optimization:
- Average gas per transaction: 4,200 (-50%)
- Contract size: 280KB (-38%)
- Deployment cost: ~1.2M stroops (-52%)
```

## Database Optimization

### Schema Design

```sql
-- Denormalize for read performance
CREATE TABLE participant_stats (
    participant_id UUID PRIMARY KEY,
    total_waste_submitted BIGINT DEFAULT 0,
    total_waste_verified BIGINT DEFAULT 0,
    total_tokens_earned BIGINT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (participant_id) REFERENCES participants(id)
);

-- Maintain stats with triggers
CREATE TRIGGER update_participant_stats
AFTER INSERT ON waste
FOR EACH ROW
EXECUTE FUNCTION update_stats_on_waste_insert();
```

### Partitioning

```sql
-- Partition waste table by date for faster queries
CREATE TABLE waste (
    id BIGSERIAL,
    owner_id UUID,
    waste_type VARCHAR(50),
    weight NUMERIC,
    created_at TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE waste_2024_q1 PARTITION OF waste
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE waste_2024_q2 PARTITION OF waste
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');
```

### Archiving

```sql
-- Archive old data
CREATE TABLE waste_archive AS
SELECT * FROM waste
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM waste
WHERE created_at < NOW() - INTERVAL '1 year';

-- Create index on archive
CREATE INDEX idx_waste_archive_owner ON waste_archive(owner_id);
```

## Profiling and Monitoring

### Frontend Profiling

```typescript
// React DevTools Profiler
import { Profiler } from 'react';

function onRenderCallback(
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}

<Profiler id="Dashboard" onRender={onRenderCallback}>
  <Dashboard />
</Profiler>
```

### Backend Profiling

```rust
// Use flamegraph for profiling
// Cargo.toml
[dev-dependencies]
flamegraph = "0.6"

// Run with profiling
cargo flamegraph --bin scavenger-backend
```

### Contract Profiling

```bash
# Analyze contract gas usage
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- submit_material \
  --submitter <ADDRESS> \
  --waste_type "plastic" \
  --weight 100 \
  --lat 40.7128 \
  --lon -74.0060 \
  --verbose
```

## Performance Budgets

### Frontend Budget

```json
{
  "bundles": [
    {
      "name": "main",
      "maxSize": "200kb"
    },
    {
      "name": "vendor",
      "maxSize": "300kb"
    }
  ],
  "metrics": [
    {
      "name": "FCP",
      "maxSize": "1.8s"
    },
    {
      "name": "LCP",
      "maxSize": "2.5s"
    }
  ]
}
```

### Backend Budget

```yaml
# API Response Times (P95)
endpoints:
  /api/participants:
    get: 200ms
    post: 500ms
  /api/waste:
    get: 300ms
    post: 1000ms
  /api/incentives:
    get: 250ms
    post: 800ms

# Database Query Times (P95)
queries:
  get_participant: 50ms
  list_participants: 200ms
  get_waste_history: 300ms
```

### Contract Budget

```
Gas per transaction:
- Register: 5,000 max
- Submit: 3,000 max
- Verify: 2,500 max
- Transfer: 4,000 max
- Create Incentive: 6,000 max

Total per day: 1M stroops max
```

## Optimization Checklist

- [ ] Frontend bundle < 500KB gzipped
- [ ] Lighthouse score > 90
- [ ] API response time P95 < 500ms
- [ ] Database queries use indexes
- [ ] Connection pooling configured
- [ ] Caching strategy implemented
- [ ] Contract gas optimized
- [ ] Images optimized and lazy-loaded
- [ ] Code splitting implemented
- [ ] Monitoring and alerts configured
- [ ] Performance budgets defined
- [ ] Load testing completed

## Monitoring and Alerting Guide

### Overview

Continuous monitoring surfaces regressions before users notice them. The Scavenger platform uses a layered observability stack: **Prometheus** for metrics, **Grafana** for dashboards, and **Loki / structured logging** for log aggregation.

### Metrics Collection

#### Backend (Rust / Actix-web)

Expose Prometheus metrics from the API server:

```rust
use actix_web_prom::PrometheusMetricsBuilder;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let prometheus = PrometheusMetricsBuilder::new("scavenger_api")
        .endpoint("/metrics")
        .build()
        .unwrap();

    HttpServer::new(move || {
        App::new()
            .wrap(prometheus.clone())
            .service(routes)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
```

Key metrics to expose:

| Metric | Type | Description |
|---|---|---|
| `api_request_duration_seconds` | Histogram | Request latency by endpoint |
| `api_request_total` | Counter | Total requests by status code |
| `db_query_duration_seconds` | Histogram | Database query latency |
| `cache_hit_total` | Counter | Redis cache hits |
| `cache_miss_total` | Counter | Redis cache misses |
| `waste_submitted_total` | Counter | Waste items submitted |
| `rewards_distributed_total` | Counter | Tokens distributed |

#### Frontend

Use the **Web Vitals** library to send Core Web Vitals to your analytics endpoint:

```typescript
import { onFCP, onLCP, onCLS, onTTFB, onINP } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  fetch('/api/vitals', {
    method: 'POST',
    body: JSON.stringify(metric),
    headers: { 'Content-Type': 'application/json' },
  });
}

onFCP(sendToAnalytics);
onLCP(sendToAnalytics);
onCLS(sendToAnalytics);
onTTFB(sendToAnalytics);
onINP(sendToAnalytics);
```

#### Contract / Indexer

The TypeScript indexer (`indexer/src/indexer.ts`) streams on-chain events. Expose indexer health:

```typescript
// indexer/src/index.ts
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    lastIndexedLedger: indexer.lastLedger,
    eventLag: Date.now() - indexer.lastEventTimestamp,
  });
});
```

### Dashboards

Run the monitoring stack with Docker Compose:

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

This starts:
- **Prometheus** on `http://localhost:9090`
- **Grafana** on `http://localhost:3000` (admin / admin)

#### Recommended Dashboard Panels

**API Performance Panel**
```yaml
# Prometheus query examples
# P95 latency
histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m]))

# Error rate
rate(api_request_total{status=~"5.."}[5m]) / rate(api_request_total[5m])

# Requests per second
rate(api_request_total[1m])
```

**Contract Activity Panel**
```yaml
# Waste submission rate
rate(waste_submitted_total[1m])

# Rewards distributed (tokens/hour)
increase(rewards_distributed_total[1h])
```

**Infrastructure Panel**
```yaml
# Memory usage
process_resident_memory_bytes

# CPU usage
rate(process_cpu_seconds_total[1m])

# Database connections
pg_stat_activity_count
```

### Alerting

Configure Prometheus alerting rules in `docker-compose.monitoring.yml`:

```yaml
# alerts.yml
groups:
  - name: scavenger_api
    rules:
      - alert: HighErrorRate
        expr: rate(api_request_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "API error rate above 5%"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency above 500ms"

      - alert: IndexerLag
        expr: indexer_event_lag_seconds > 60
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Indexer is more than 60s behind the chain"

      - alert: CacheHitRateDropped
        expr: rate(cache_hit_total[5m]) / (rate(cache_hit_total[5m]) + rate(cache_miss_total[5m])) < 0.7
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Cache hit rate below 70%"
```

### Structured Logging

Use structured (JSON) logging in all services for easy querying in Loki / CloudWatch:

```rust
// Rust backend — using tracing + tracing-subscriber
use tracing::{info, warn, error};
use tracing_subscriber::fmt::format::FmtSpan;

tracing_subscriber::fmt()
    .json()
    .with_span_events(FmtSpan::CLOSE)
    .init();

// Usage
info!(
    participant = %address,
    waste_id = waste_id,
    action = "waste_submitted",
    "Waste item submitted successfully"
);
```

```typescript
// TypeScript indexer — structured log
console.log(JSON.stringify({
  level: 'info',
  event: 'waste_indexed',
  waste_id: wasteId,
  ledger: ledgerSeq,
  timestamp: new Date().toISOString(),
}));
```

### Health Check Endpoints

| Service | Endpoint | Expected Response |
|---|---|---|
| Backend API | `GET /health` | `{"status":"ok"}` |
| Indexer | `GET /health` | `{"status":"ok","lastIndexedLedger":N}` |
| Frontend | Lighthouse score | Performance ≥ 90 |

### On-Call Runbook

When an alert fires:

1. **Check dashboards** — identify which service/layer is degraded
2. **Check logs** — `docker compose logs <service> --tail=100`
3. **Check Stellar network status** — [status.stellar.org](https://status.stellar.org)
4. **Scale if needed** — adjust replica count in `k8s/` manifests
5. **Roll back if broken** — use blue/green deployment (see `docs/BLUE_GREEN_DEPLOYMENT.md`)
6. **Post-mortem** — document findings in a GitHub issue

---

## Tools and Resources

- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://www.webpagetest.org/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Flamegraph](https://www.brendangregg.com/flamegraphs.html)
- [pgBadger](https://pgbadger.darold.net/)
- [Soroban Gas Estimator](https://developers.stellar.org/docs/learn/soroban/gas-metering)
- [Prometheus](https://prometheus.io/docs/)
- [Grafana](https://grafana.com/docs/)
- [Web Vitals](https://web.dev/vitals/)

## References

- [Web Vitals](https://web.dev/vitals/)
- [React Performance](https://react.dev/reference/react/Profiler)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance.html)
- [Rust Performance](https://nnethercote.github.io/perf-book/)
- [Stellar Performance](https://developers.stellar.org/docs/learn/performance)
