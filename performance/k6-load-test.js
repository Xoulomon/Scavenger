import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const CONTRACT_ID = __ENV.CONTRACT_ID || 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const contractCallDuration = new Trend('contract_call_duration');
const successCount = new Counter('success_count');
const failureCount = new Counter('failure_count');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up
    { duration: '1m30s', target: 50 }, // Stay at 50
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'errors': ['rate<0.1'],
    'api_duration': ['p(95)<500'],
  },
};

export default function () {
  group('Participant Operations', () => {
    const registerPayload = JSON.stringify({
      address: `GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQSTBE2BRUY4DQAT2`,
      role: 0,
      name: `Recycler-${__VU}-${__ITER}`,
      lat: 40.7128,
      lon: -74.006,
    });

    const registerRes = http.post(`${BASE_URL}/api/participants/register`, registerPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(registerRes, {
      'register status 200': (r) => r.status === 200,
      'register response time < 500ms': (r) => r.timings.duration < 500,
    }) ? successCount.add(1) : failureCount.add(1);

    apiDuration.add(registerRes.timings.duration);
    errorRate.add(registerRes.status !== 200);
    sleep(1);
  });

  group('Waste Submission', () => {
    const wastePayload = JSON.stringify({
      submitter: `GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQSTBE2BRUY4DQAT2`,
      waste_type: 0,
      weight: 100,
      lat: 40.7128,
      lon: -74.006,
    });

    const wasteRes = http.post(`${BASE_URL}/api/waste/submit`, wastePayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(wasteRes, {
      'waste submit status 200': (r) => r.status === 200,
      'waste response time < 1000ms': (r) => r.timings.duration < 1000,
    }) ? successCount.add(1) : failureCount.add(1);

    contractCallDuration.add(wasteRes.timings.duration);
    errorRate.add(wasteRes.status !== 200);
    sleep(1);
  });

  group('Query Operations', () => {
    const queryRes = http.get(
      `${BASE_URL}/api/participants/GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQSTBE2BRUY4DQAT2`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    check(queryRes, {
      'query status 200': (r) => r.status === 200,
      'query response time < 300ms': (r) => r.timings.duration < 300,
    }) ? successCount.add(1) : failureCount.add(1);

    apiDuration.add(queryRes.timings.duration);
    errorRate.add(queryRes.status !== 200);
    sleep(1);
  });
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'performance/results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  let summary = '\n=== Performance Test Summary ===\n';

  if (data.metrics) {
    summary += `${indent}API Duration (p95): ${data.metrics.api_duration?.values?.['p(95)']?.toFixed(2)}ms\n`;
    summary += `${indent}Contract Call Duration (p95): ${data.metrics.contract_call_duration?.values?.['p(95)']?.toFixed(2)}ms\n`;
    summary += `${indent}Error Rate: ${(data.metrics.errors?.values?.rate * 100)?.toFixed(2)}%\n`;
    summary += `${indent}Success Count: ${data.metrics.success_count?.value}\n`;
    summary += `${indent}Failure Count: ${data.metrics.failure_count?.value}\n`;
  }

  return summary;
}
