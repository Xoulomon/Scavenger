import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

export const errorRate = new Rate('waste_submission_errors');
export const submissionDuration = new Trend('waste_submission_duration', true);
export const registrationDuration = new Trend('participant_registration_duration', true);
export const fullFlowDuration = new Trend('full_flow_duration', true);
export const successCount = new Counter('waste_submission_successes');
export const failureCount = new Counter('waste_submission_failures');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

const WASTE_TYPES = ['plastic', 'paper', 'glass', 'metal', 'organic'];

function getRandomWasteType() {
  return WASTE_TYPES[Math.floor(Math.random() * WASTE_TYPES.length)];
}

function getRandomWeight() {
  return Math.floor(Math.random() * 900) + 100;
}

function registerParticipant(userId) {
  const payload = JSON.stringify({
    address: userId,
    role: 'recycler',
    name: `Perf Test User ${userId}`,
    lat: 40.7128 + (Math.random() - 0.5) * 0.01,
    lon: -74.006 + (Math.random() - 0.5) * 0.01,
  });

  const res = http.post(`${BASE_URL}/participants/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'register_participant' },
  });

  const ok = check(res, {
    'register: status 200 or 409': (r) => r.status === 200 || r.status === 409,
  });

  registrationDuration.add(res.timings.duration);
  if (!ok) {
    errorRate.add(1);
  }
  return res;
}

function submitWaste(userId) {
  const payload = JSON.stringify({
    submitter: userId,
    waste_type: getRandomWasteType(),
    weight: getRandomWeight(),
    lat: 40.7128 + (Math.random() - 0.5) * 0.01,
    lon: -74.006 + (Math.random() - 0.5) * 0.01,
  });

  const res = http.post(`${BASE_URL}/waste/submit`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'submit_waste' },
  });

  const ok = check(res, {
    'submit waste: status 200': (r) => r.status === 200,
  });

  submissionDuration.add(res.timings.duration);
  if (ok) {
    successCount.add(1);
  } else {
    failureCount.add(1);
    errorRate.add(1);
  }
  return res;
}

export const options = {
  scenarios: {
    waste_submission_regression: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: [
      'p(50)<400',
      'p(95)<800',
      'p(99)<1500',
    ],
    http_req_failed: ['rate<0.1'],
    waste_submission_errors: ['rate<0.1'],
    waste_submission_duration: ['p(95)<800'],
    participant_registration_duration: ['p(95)<500'],
  },
};

export default function () {
  const userId = `regression_${__VU}_${__ITER}`;

  group('Waste Submission Regression Flow', () => {
    group('1. Register Participant', () => {
      registerParticipant(userId);
    });

    sleep(0.5);

    group('2. Submit Waste', () => {
      const submitRes = submitWaste(userId);
      const body = submitRes.json ? submitRes.json() : null;
      const wasteId = body?.waste_id || body?.id || null;

      if (wasteId) {
        sleep(0.3);

        group('3. Verify Waste', () => {
          const verifyPayload = JSON.stringify({
            waste_id: wasteId,
            verifier: userId,
          });
          const verifyRes = http.post(`${BASE_URL}/waste/verify/${wasteId}`, verifyPayload, {
            headers: { 'Content-Type': 'application/json' },
            tags: { endpoint: 'verify_waste' },
          });
          check(verifyRes, {
            'verify waste: status 200 or 404': (r) => r.status === 200 || r.status === 404,
          });
        });
      }
    });

    group('4. Query Incentives', () => {
      const incentivesRes = http.get(`${BASE_URL}/incentives/active`, {
        tags: { endpoint: 'get_incentives' },
      });
      check(incentivesRes, {
        'get incentives: status 200': (r) => r.status === 200,
      });
    });
  });

  sleep(1);
}

export function handleSummary(data) {
  const p50 = data.metrics.http_req_duration?.values?.['p(50)'] || 0;
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const errorRateVal = data.metrics.http_req_failed?.values?.rate || 0;
  const throughput = data.metrics.http_reqs?.values?.count || 0;
  const duration = data.metrics.http_reqs?.values?.avg || 0;

  const summary = `
# Waste Submission Regression Test Results

**Date:** ${new Date().toISOString()}
**Target:** ${BASE_URL}

## Latency Metrics
| Percentile | Duration |
|------------|----------|
| p50        | ${p50.toFixed(2)}ms |
| p95        | ${p95.toFixed(2)}ms |
| p99        | ${p99.toFixed(2)}ms |

## Throughput & Errors
| Metric | Value |
|--------|-------|
| Total Requests | ${throughput} |
| Error Rate | ${(errorRateVal * 100).toFixed(2)}% |

## Regression Thresholds
| Metric | Threshold | Actual | Status |
|--------|-----------|--------|--------|
| p50 latency | < 400ms | ${p50.toFixed(2)}ms | ${p50 < 400 ? 'PASS' : 'FAIL'} |
| p95 latency | < 800ms | ${p95.toFixed(2)}ms | ${p95 < 800 ? 'PASS' : 'FAIL'} |
| p99 latency | < 1500ms | ${p99.toFixed(2)}ms | ${p99 < 1500 ? 'PASS' : 'FAIL'} |
| Error rate | < 10% | ${(errorRateVal * 100).toFixed(2)}% | ${errorRateVal < 0.1 ? 'PASS' : 'FAIL'} |
`;

  const thresholds = data.thresholds;
  const failedThresholds = Object.entries(thresholds || {})
    .filter(([_, v]) => v.ok === false)
    .map(([k]) => k);

  if (failedThresholds.length > 0) {
    console.error(`\nFAILED THRESHOLDS: ${failedThresholds.join(', ')}\n`);
  }

  return {
    stdout: summary,
    'performance/reports/waste-submission-regression-results.json': JSON.stringify(data, null, 2),
  };
}
