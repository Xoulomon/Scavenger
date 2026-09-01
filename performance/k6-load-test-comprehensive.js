import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const successCount = new Counter('success_count');
const activeConnections = new Gauge('active_connections');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';
const RAMP_UP_TIME = '2m';
const SUSTAIN_TIME = '5m';
const RAMP_DOWN_TIME = '2m';

export const options = {
  stages: [
    // Scenario 1: 100 concurrent users
    {
      duration: RAMP_UP_TIME,
      target: 100,
      name: '100 Users Ramp-up'
    },
    {
      duration: SUSTAIN_TIME,
      target: 100,
      name: '100 Users Sustain'
    },
    {
      duration: RAMP_DOWN_TIME,
      target: 0,
      name: '100 Users Ramp-down'
    },
    // Scenario 2: 1000 concurrent users
    {
      duration: RAMP_UP_TIME,
      target: 1000,
      name: '1000 Users Ramp-up'
    },
    {
      duration: SUSTAIN_TIME,
      target: 1000,
      name: '1000 Users Sustain'
    },
    {
      duration: RAMP_DOWN_TIME,
      target: 0,
      name: '1000 Users Ramp-down'
    },
    // Scenario 3: 10000 concurrent users (stress test)
    {
      duration: RAMP_UP_TIME,
      target: 10000,
      name: '10000 Users Ramp-up'
    },
    {
      duration: SUSTAIN_TIME,
      target: 10000,
      name: '10000 Users Sustain'
    },
    {
      duration: RAMP_DOWN_TIME,
      target: 0,
      name: '10000 Users Ramp-down'
    }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.1'],
    'errors': ['rate<0.1']
  },
  ext: {
    loadimpact: {
      projectID: 3356643,
      name: 'Scavenger Load Test'
    }
  }
};

export default function () {
  const userId = `user_${__VU}_${__ITER}`;

  group('Participant Operations', () => {
    // Register participant
    let registerRes = http.post(`${BASE_URL}/participants/register`, {
      address: userId,
      role: 'recycler',
      name: `Test User ${__VU}`,
      lat: 0,
      lon: 0
    });

    check(registerRes, {
      'register status is 200': (r) => r.status === 200 || r.status === 409,
      'register response time < 500ms': (r) => r.timings.duration < 500
    });

    apiDuration.add(registerRes.timings.duration);
    if (registerRes.status !== 200 && registerRes.status !== 409) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);

    // Get participant
    let getRes = http.get(`${BASE_URL}/participants/${userId}`);
    check(getRes, {
      'get participant status is 200': (r) => r.status === 200,
      'get response time < 300ms': (r) => r.timings.duration < 300
    });

    apiDuration.add(getRes.timings.duration);
    if (getRes.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });

  group('Waste Operations', () => {
    // Submit waste
    let submitRes = http.post(`${BASE_URL}/waste/submit`, {
      submitter: userId,
      waste_type: 'plastic',
      weight: Math.floor(Math.random() * 1000) + 1,
      lat: 0,
      lon: 0
    });

    check(submitRes, {
      'submit waste status is 200': (r) => r.status === 200,
      'submit response time < 500ms': (r) => r.timings.duration < 500
    });

    apiDuration.add(submitRes.timings.duration);
    if (submitRes.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);

    // Get participant wastes
    let wastesRes = http.get(`${BASE_URL}/participants/${userId}/wastes`);
    check(wastesRes, {
      'get wastes status is 200': (r) => r.status === 200,
      'get wastes response time < 500ms': (r) => r.timings.duration < 500
    });

    apiDuration.add(wastesRes.timings.duration);
    if (wastesRes.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });

  group('Incentive Operations', () => {
    // Get active incentives
    let incentivesRes = http.get(`${BASE_URL}/incentives/active`);
    check(incentivesRes, {
      'get incentives status is 200': (r) => r.status === 200,
      'get incentives response time < 500ms': (r) => r.timings.duration < 500
    });

    apiDuration.add(incentivesRes.timings.duration);
    if (incentivesRes.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });

  group('Query Operations', () => {
    // Get metrics
    let metricsRes = http.get(`${BASE_URL}/metrics`);
    check(metricsRes, {
      'get metrics status is 200': (r) => r.status === 200,
      'get metrics response time < 500ms': (r) => r.timings.duration < 500
    });

    apiDuration.add(metricsRes.timings.duration);
    if (metricsRes.status !== 200) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }

    sleep(0.5);
  });

  activeConnections.add(__VU);
  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reports/load-test-results.json': JSON.stringify(data)
  };
}

function textSummary(data, options) {
  let summary = '\n=== Load Test Summary ===\n';

  if (data.metrics) {
    summary += '\nMetrics:\n';
    for (const [name, metric] of Object.entries(data.metrics)) {
      if (metric.values) {
        summary += `  ${name}: ${JSON.stringify(metric.values)}\n`;
      }
    }
  }

  return summary;
}
