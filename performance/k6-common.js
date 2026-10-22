/**
 * Common utilities and shared configuration for k6 performance tests
 * This module provides standardized metrics, helpers, and configuration
 * for all performance testing scenarios.
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

/**
 * Custom metrics shared across all test profiles
 */
export const metrics = {
  // Error tracking
  errorRate: new Rate('error_rate'),
  httpErrors: new Rate('http_errors'),

  // Duration tracking
  apiDuration: new Trend('api_duration_ms'),
  contractCallDuration: new Trend('contract_call_duration_ms'),
  participantOpDuration: new Trend('participant_op_duration_ms'),
  wasteOpDuration: new Trend('waste_op_duration_ms'),
  queryOpDuration: new Trend('query_op_duration_ms'),

  // Counters
  successCount: new Counter('success_count'),
  failureCount: new Counter('failure_count'),
  participantOpsCount: new Counter('participant_ops_count'),
  wasteOpsCount: new Counter('waste_ops_count'),
  queryOpsCount: new Counter('query_ops_count'),

  // Gauges
  activeConnections: new Gauge('active_connections'),
};

/**
 * Base thresholds for different load profiles
 */
export const thresholds = {
  smoke: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.01'],
    'error_rate': ['rate<0.01'],
  },
  load: {
    'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
    'http_req_failed': ['rate<0.05'],
    'error_rate': ['rate<0.05'],
  },
  stress: {
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
    'http_req_failed': ['rate<0.1'],
    'error_rate': ['rate<0.1'],
  },
  spike: {
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
    'http_req_failed': ['rate<0.15'],
    'error_rate': ['rate<0.15'],
  },
  soak: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.05'],
    'error_rate': ['rate<0.05'],
  },
};

/**
 * Stage definitions for different load profiles
 */
export const stages = {
  smoke: [
    { duration: '10s', target: 1 },
    { duration: '30s', target: 1 },
    { duration: '10s', target: 0 },
  ],
  load: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  stress: [
    { duration: '2m', target: 1000 },
    { duration: '3m', target: 2500 },
    { duration: '3m', target: 5000 },
    { duration: '2m', target: 10000 },
    { duration: '3m', target: 10000 },
    { duration: '2m', target: 0 },
  ],
  spike: [
    { duration: '1m', target: 100 },
    { duration: '30s', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 0 },
  ],
  soak: [
    { duration: '5m', target: 500 },
    { duration: '30m', target: 500 },
    { duration: '5m', target: 0 },
  ],
};

/**
 * Environment configuration
 */
export function getConfig() {
  return {
    baseUrl: __ENV.BASE_URL || 'http://localhost:8000/api',
    contractId: __ENV.CONTRACT_ID || 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    timeout: parseInt(__ENV.TIMEOUT || '30000', 10),
  };
}

/**
 * Helper to make HTTP request with metrics tracking
 */
export function makeRequest(method, url, payload = null, headers = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  let response;
  try {
    if (method === 'GET') {
      response = http.get(url, { headers: defaultHeaders });
    } else if (method === 'POST') {
      response = http.post(url, payload, { headers: defaultHeaders });
    } else if (method === 'PUT') {
      response = http.put(url, payload, { headers: defaultHeaders });
    } else if (method === 'DELETE') {
      response = http.del(url, { headers: defaultHeaders });
    }

    // Track metrics
    metrics.apiDuration.add(response.timings.duration);
    metrics.errorRate.add(response.status >= 400);
    metrics.httpErrors.add(response.status >= 400 ? 1 : 0);

    return response;
  } catch (error) {
    metrics.errorRate.add(1);
    metrics.failureCount.add(1);
    throw error;
  }
}

/**
 * Helper to check response and track success/failure
 */
export function checkResponse(response, checks = {}) {
  const defaultChecks = {
    'status 2xx': (r) => r.status >= 200 && r.status < 300,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  };

  const allChecks = { ...defaultChecks, ...checks };
  const result = check(response, allChecks);

  if (result) {
    metrics.successCount.add(1);
  } else {
    metrics.failureCount.add(1);
  }

  return result;
}

/**
 * Common test scenarios
 */
export const scenarios = {
  registerParticipant(config, address, role, name) {
    return group('Register Participant', () => {
      const payload = JSON.stringify({
        address,
        role,
        name,
        latitude: 40.7128 + Math.random() * 0.1,
        longitude: -74.006 + Math.random() * 0.1,
      });

      const response = makeRequest('POST', `${config.baseUrl}/participants/register`, payload);
      return checkResponse(response, {
        'register successful': (r) => r.status === 200 || r.status === 201,
      });
    });
  },

  submitWaste(config, submitter, wasteType, weight) {
    return group('Submit Waste', () => {
      const payload = JSON.stringify({
        submitter,
        waste_type: wasteType,
        weight,
        latitude: 40.7128 + Math.random() * 0.1,
        longitude: -74.006 + Math.random() * 0.1,
      });

      const response = makeRequest('POST', `${config.baseUrl}/waste/submit`, payload);
      metrics.wasteOpDuration.add(response.timings.duration);
      metrics.wasteOpsCount.add(1);

      return checkResponse(response, {
        'waste submission successful': (r) => r.status === 200 || r.status === 201,
      });
    });
  },

  transferWaste(config, wasteId, from, to) {
    return group('Transfer Waste', () => {
      const payload = JSON.stringify({
        waste_id: wasteId,
        from,
        to,
      });

      const response = makeRequest('POST', `${config.baseUrl}/waste/transfer`, payload);
      metrics.wasteOpDuration.add(response.timings.duration);
      metrics.wasteOpsCount.add(1);

      return checkResponse(response, {
        'transfer successful': (r) => r.status === 200,
      });
    });
  },

  queryParticipant(config, address) {
    return group('Query Participant', () => {
      const response = makeRequest('GET', `${config.baseUrl}/participants/${address}`);
      metrics.queryOpDuration.add(response.timings.duration);
      metrics.queryOpsCount.add(1);

      return checkResponse(response, {
        'query successful': (r) => r.status === 200,
      });
    });
  },

  queryWaste(config, wasteId) {
    return group('Query Waste', () => {
      const response = makeRequest('GET', `${config.baseUrl}/waste/${wasteId}`);
      metrics.queryOpDuration.add(response.timings.duration);
      metrics.queryOpsCount.add(1);

      return checkResponse(response, {
        'query successful': (r) => r.status === 200,
      });
    });
  },

  getGlobalMetrics(config) {
    return group('Get Global Metrics', () => {
      const response = makeRequest('GET', `${config.baseUrl}/metrics/global`);
      metrics.queryOpDuration.add(response.timings.duration);
      metrics.queryOpsCount.add(1);

      return checkResponse(response, {
        'metrics query successful': (r) => r.status === 200,
      });
    });
  },
};

/**
 * Helper to generate test data
 */
export function generateAddress() {
  return `GBUGQZF3KZWXJK7EFMKUQX4VTVR3XLDNVJ6HQZULYGF${Math.random().toString(36).substring(7).toUpperCase()}`
    .substring(0, 56);
}

/**
 * Helper to sleep between operations
 */
export function smartSleep(baseMs = 1000, variance = 0.2) {
  const delay = baseMs * (1 + (Math.random() - 0.5) * variance);
  __VU; // Reference to avoid unused variable warning
}
