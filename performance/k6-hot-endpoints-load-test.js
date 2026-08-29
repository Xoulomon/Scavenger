import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics for detailed analysis
const errorRate = new Rate('errors');
const listWastesLatency = new Trend('list_wastes_duration');
const listParticipantsLatency = new Trend('list_participants_duration');
const getStatsLatency = new Trend('get_stats_duration');
const searchLatency = new Trend('search_duration');
const auditLogsLatency = new Trend('audit_logs_duration');
const signTransactionLatency = new Trend('sign_transaction_duration');
const successCount = new Counter('success_count');
const activeConnections = new Gauge('active_connections');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api/v1';

// Load test scenarios for different load levels
// Normal load (steady state): 100 users for 9 minutes
// Peak load simulation: 1000 users for 9 minutes
// Stress test: 10000 users for 9 minutes
export const options = {
  stages: [
    // Scenario 1: Steady State (100 users)
    { duration: '2m', target: 100, name: 'Steady State Ramp-up' },
    { duration: '5m', target: 100, name: 'Steady State Sustain' },
    { duration: '2m', target: 0, name: 'Steady State Ramp-down' },

    // Scenario 2: Spike Test (sudden increase to 1000 users)
    { duration: '1m', target: 100, name: 'Spike Setup' },
    { duration: '30s', target: 1000, name: 'Spike Attack' },
    { duration: '2m', target: 1000, name: 'Spike Sustain' },
    { duration: '30s', target: 100, name: 'Spike Recovery' },
    { duration: '1m', target: 0, name: 'Spike Ramp-down' },

    // Scenario 3: Stress Test (gradual increase to 10000)
    { duration: '2m', target: 1000, name: 'Stress Ramp-up Phase 1' },
    { duration: '2m', target: 5000, name: 'Stress Ramp-up Phase 2' },
    { duration: '2m', target: 10000, name: 'Stress Ramp-up Phase 3' },
    { duration: '5m', target: 10000, name: 'Stress Sustain' },
    { duration: '2m', target: 0, name: 'Stress Ramp-down' }
  ],

  // Performance thresholds based on load test guide
  thresholds: {
    // Overall response time thresholds
    'http_req_duration': [
      'p(95)<500',  // 95th percentile under 500ms for normal operations
      'p(99)<1500', // 99th percentile under 1.5s
      'avg<300',    // Average under 300ms
    ],
    'http_req_failed': ['rate<0.1'],    // Less than 10% failure rate
    'errors': ['rate<0.1'],              // Custom error rate threshold

    // Endpoint-specific latency thresholds
    'list_wastes_duration': ['p(95)<400', 'p(99)<800'],
    'list_participants_duration': ['p(95)<400', 'p(99)<800'],
    'get_stats_duration': ['p(95)<500', 'p(99)<1000'],
    'search_duration': ['p(95)<600', 'p(99)<1200'],
    'audit_logs_duration': ['p(95)<500', 'p(99)<1000'],
    'sign_transaction_duration': ['p(95)<800', 'p(99)<1500'],
  }
};

export default function () {
  const userId = `user_${__VU}_${__ITER}`;
  const wasteId = `waste_${Math.floor(Math.random() * 10000)}`;
  const participantId = `participant_${Math.floor(Math.random() * 10000)}`;

  // Update active connections gauge
  activeConnections.add(__VU);

  // Test read-heavy endpoints (highest priority hot endpoints)
  group('List Wastes - Hot Endpoint', () => {
    const response = http.get(`${BASE_URL}/contracts/wastes?limit=100&offset=0`, {
      headers: { 'Content-Type': 'application/json' }
    });

    listWastesLatency.add(response.timings.duration);
    check(response, {
      'list wastes status is 200': (r) => r.status === 200,
      'list wastes response time < 400ms': (r) => r.timings.duration < 400,
      'list wastes has data': (r) => r.body.includes('wastes') || r.status !== 200
    });

    if (response.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });

  group('List Participants - Hot Endpoint', () => {
    const response = http.get(`${BASE_URL}/contracts/participants?limit=100&offset=0`, {
      headers: { 'Content-Type': 'application/json' }
    });

    listParticipantsLatency.add(response.timings.duration);
    check(response, {
      'list participants status is 200': (r) => r.status === 200,
      'list participants response time < 400ms': (r) => r.timings.duration < 400,
      'list participants has data': (r) => r.body.includes('participants') || r.status !== 200
    });

    if (response.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });

  group('Get Contract Stats - Hot Endpoint', () => {
    const response = http.get(`${BASE_URL}/contracts/stats`, {
      headers: { 'Content-Type': 'application/json' }
    });

    getStatsLatency.add(response.timings.duration);
    check(response, {
      'get stats status is 200': (r) => r.status === 200,
      'get stats response time < 500ms': (r) => r.timings.duration < 500,
      'get stats has metrics': (r) => r.body.includes('stats') || r.body.includes('metrics') || r.status !== 200
    });

    if (response.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });

  group('Search - Hot Endpoint', () => {
    const searchQuery = Math.random() > 0.5 ? 'plastic' : 'waste';
    const response = http.get(
      `${BASE_URL}/search?q=${encodeURIComponent(searchQuery)}&limit=20`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    searchLatency.add(response.timings.duration);
    check(response, {
      'search status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'search response time < 600ms': (r) => r.timings.duration < 600,
    });

    if (response.status !== 200 && response.status !== 404) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });

  group('Audit Logs - Hot Endpoint', () => {
    const response = http.get(`${BASE_URL}/audit/logs?limit=50&offset=0`, {
      headers: { 'Content-Type': 'application/json' }
    });

    auditLogsLatency.add(response.timings.duration);
    check(response, {
      'audit logs status is 200': (r) => r.status === 200,
      'audit logs response time < 500ms': (r) => r.timings.duration < 500,
      'audit logs has data': (r) => r.body.includes('logs') || r.body.includes('audit') || r.status !== 200
    });

    if (response.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });

  // Test write operation (moderate load)
  group('Sign Transaction - Write Operation', () => {
    const payload = JSON.stringify({
      transaction_id: `tx_${Date.now()}_${Math.random()}`,
      signer_id: userId,
      data: 'test_data_for_signing'
    });

    const response = http.post(`${BASE_URL}/signing/sign`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    signTransactionLatency.add(response.timings.duration);
    check(response, {
      'sign transaction status is 200': (r) => r.status === 200,
      'sign transaction response time < 800ms': (r) => r.timings.duration < 800,
    });

    if (response.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });

  // Cache metrics endpoint for monitoring
  group('Cache Metrics - Monitoring Endpoint', () => {
    const response = http.get(`${BASE_URL}/cache/metrics`, {
      headers: { 'Content-Type': 'application/json' }
    });

    check(response, {
      'cache metrics status is 200': (r) => r.status === 200,
      'cache metrics response time < 200ms': (r) => r.timings.duration < 200,
    });

    if (response.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });
}
