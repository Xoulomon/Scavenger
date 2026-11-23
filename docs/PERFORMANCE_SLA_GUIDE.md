# Performance SLA Guide

This document defines Scavngr's Service Level Agreements (SLAs), explains how they are measured, and provides runbooks for responding to violations.

---

## SLA Categories

| Category         | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| **Availability** | Percentage uptime for each service component               |
| **Latency**      | Response-time targets at P95/P99 percentiles               |
| **Web Vitals**   | Core Web Vitals targets for the frontend                   |
| **Error Rate**   | Maximum acceptable HTTP 5xx and contract error percentages |
| **Throughput**   | Minimum request/transaction processing rates               |

---

## SLA Targets

### Availability

| SLA                      | Target          | Period  | Service       |
| ------------------------ | --------------- | ------- | ------------- |
| API Availability         | ≥ 99.9 % uptime | Monthly | Backend API   |
| Stellar RPC Availability | ≥ 99.5 % uptime | Monthly | Soroban RPC   |
| Indexer Availability     | ≥ 99.0 % uptime | Monthly | Event Indexer |

### Latency

| SLA                     | Target      | Period | Service          |
| ----------------------- | ----------- | ------ | ---------------- |
| API P95 Latency         | ≤ 500 ms    | Daily  | Backend API      |
| API P99 Latency         | ≤ 2000 ms   | Daily  | Backend API      |
| Contract Submission P95 | ≤ 10 000 ms | Daily  | Soroban Contract |

### Web Vitals

| SLA                             | Target           | Period | Reference                          |
| ------------------------------- | ---------------- | ------ | ---------------------------------- |
| Largest Contentful Paint (LCP)  | ≤ 2500 ms (Good) | Weekly | [web.dev/lcp](https://web.dev/lcp) |
| Interaction to Next Paint (INP) | ≤ 200 ms (Good)  | Weekly | [web.dev/inp](https://web.dev/inp) |

### Error Rate

| SLA                  | Target                 | Period | Service          |
| -------------------- | ---------------------- | ------ | ---------------- |
| API Error Rate (5xx) | ≤ 0.1 % of requests    | Daily  | Backend API      |
| Contract Error Rate  | ≤ 1.0 % of invocations | Daily  | Soroban Contract |

### Throughput

| SLA                         | Target                 | Period | Service                |
| --------------------------- | ---------------------- | ------ | ---------------------- |
| Waste Submission Throughput | ≥ 10 submissions / min | Daily  | Backend API + Contract |

---

## Measurement Methodology

### Availability

```
uptime_percent = (total_minutes - downtime_minutes) / total_minutes × 100
```

Measured by health-check probes against each service endpoint every 60 seconds. A service is considered down when ≥ 3 consecutive probes fail.

**Sources**:

- Backend API: `GET /health`
- Stellar RPC: `POST /` (JSON-RPC `getHealth`)
- Indexer: `GET /api/health`

### Latency

Measured at the reverse-proxy (nginx / ALB) level, capturing wall-clock time from first request byte to last response byte. Percentiles computed over a rolling 5-minute window.

Exported as Prometheus metrics:

```
scavngr_http_request_duration_ms{handler, method, status}
```

### Web Vitals

Collected in the browser via the [web-vitals](https://github.com/GoogleChrome/web-vitals) library and sent to the analytics endpoint. Aggregated daily from real-user measurements (RUM).

### Error Rate

```
error_rate = (5xx_count / total_request_count) × 100
```

Computed per 1-minute window; rolling 24-hour average reported in SLA dashboard.

### Throughput

Measured by Prometheus counter `scavngr_waste_submissions_total`, scraped every 15 seconds, rate computed over 1-minute windows.

---

## Alerting Thresholds

Alerts fire **before** an SLA is violated to give engineers time to intervene.

| SLA                 | Warning   | Critical |
| ------------------- | --------- | -------- |
| API Availability    | < 99.95 % | < 99.9 % |
| API P95 Latency     | > 400 ms  | > 500 ms |
| API Error Rate      | > 0.05 %  | > 0.1 %  |
| Contract Error Rate | > 0.5 %   | > 1.0 %  |

Alert configuration lives in `config/alerting-rules.yml` (Prometheus AlertManager).

---

## Violation Procedures

### API Availability Violation

1. **Detect** — AlertManager fires `APIAvailabilityViolation`
2. **Page** on-call engineer via PagerDuty (P1)
3. **Triage** — Check `kubectl logs deployment/backend` and `kubectl describe pod`
4. **Mitigate** — Roll back last deployment if correlated; scale replicas if CPU > 80%
5. **Escalate** — Notify engineering lead if unresolved within 15 min
6. **Resolve** — Post incident update to status page; open incident ticket

### Latency SLA Violation

1. Pull slow-query log: `kubectl exec -it postgres-0 -- psql -c "SELECT * FROM pg_stat_activity WHERE wait_event IS NOT NULL"`
2. Check Redis hit-rate: `redis-cli INFO stats | grep hit_rate`
3. Profile hot endpoints: enable `SCAVNGR_TRACE=true` in backend and review Jaeger traces
4. Apply query indexes or result caching as needed
5. Scale API if CPU-bound: `kubectl scale deployment/backend --replicas=N`

### Web Vitals SLA Violation

1. Run Lighthouse CI: `npx lhci autorun`
2. Identify offending resources in the LCP/INP audit
3. Optimise: lazy-load below-fold images, code-split large bundles, defer non-critical scripts
4. Validate with [PageSpeed Insights](https://pagespeed.web.dev/)

### Contract Error Rate Violation

1. Check `contract_error_rate` Grafana panel for error type breakdown
2. Review recent contract deployments for unintended validation changes
3. If regression: redeploy previous WASM version via `scripts/blue-green-deploy.sh`
4. Notify blockchain team with error samples

---

## SLA Dashboard

The live SLA dashboard is available in the platform frontend at **`/slas`**.

It shows:

- Compliance percentage per SLA
- Historical measurement charts
- Active violations with elapsed time
- Violation procedure quick-reference

For production Prometheus/Grafana integration, see the Grafana dashboard provisioned at `config/grafana/provisioning/dashboards/`.

---

## SLA Review Cadence

| Review              | Frequency             | Participants                       |
| ------------------- | --------------------- | ---------------------------------- |
| Weekly SLA review   | Every Monday          | Engineering lead, On-call rotation |
| Monthly SLA report  | First Monday of month | Engineering + Product              |
| Quarterly SLA audit | Q1/Q2/Q3/Q4           | All stakeholders                   |

---

## Changelog

| Date       | Change                                 |
| ---------- | -------------------------------------- |
| 2026-06-27 | Initial SLA guide created (issue #789) |
