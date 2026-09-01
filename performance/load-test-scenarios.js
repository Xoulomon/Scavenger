import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const successCount = new Counter('success_count');

// Scenario 1: Steady State (100 users)
export const steadyState = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'http_req_failed': ['rate<0.05']
  }
};

// Scenario 2: Spike Test (sudden 1000 users)
export const spikeTest = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '30s', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'],
    'http_req_failed': ['rate<0.1']
  }
};

// Scenario 3: Stress Test (gradual increase to 10000)
export const stressTest = {
  stages: [
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 5000 },
    { duration: '2m', target: 10000 },
    { duration: '5m', target: 10000 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed': ['rate<0.2']
  }
};

// Scenario 4: Endurance Test (sustained load)
export const enduranceTest = {
  stages: [
    { duration: '5m', target: 500 },
    { duration: '30m', target: 500 },
    { duration: '5m', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'http_req_failed': ['rate<0.05']
  }
};

// Scenario 5: Ramp Test (gradual increase)
export const rampTest = {
  stages: [
    { duration: '10m', target: 5000 },
    { duration: '5m', target: 5000 },
    { duration: '5m', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'],
    'http_req_failed': ['rate<0.1']
  }
};

// Scenario 6: Wave Test (multiple waves)
export const waveTest = {
  stages: [
    { duration: '2m', target: 500 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 0 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '1m', target: 0 },
    { duration: '2m', target: 2000 },
    { duration: '2m', target: 2000 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'],
    'http_req_failed': ['rate<0.1']
  }
};

// Scenario 7: Peak Hour Simulation
export const peakHourTest = {
  stages: [
    { duration: '5m', target: 100 },
    { duration: '5m', target: 500 },
    { duration: '10m', target: 2000 },
    { duration: '10m', target: 2000 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 100 },
    { duration: '5m', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'],
    'http_req_failed': ['rate<0.1']
  }
};

// Scenario 8: Bottleneck Detection
export const bottleneckTest = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '1m', target: 1000 },
    { duration: '1m', target: 2000 },
    { duration: '1m', target: 5000 },
    { duration: '1m', target: 10000 },
    { duration: '2m', target: 10000 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed': ['rate<0.2']
  }
};

export function testParticipantEndpoint() {
  group('Participant Endpoint', () => {
    const userId = `user_${__VU}_${__ITER}`;

    let res = http.get(`${BASE_URL}/participants/${userId}`);
    check(res, {
      'status is 200': (r) => r.status === 200 || r.status === 404,
      'response time < 500ms': (r) => r.timings.duration < 500
    });

    apiDuration.add(res.timings.duration);
    if (res.status >= 400) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }
  });
}

export function testWasteEndpoint() {
  group('Waste Endpoint', () => {
    let res = http.get(`${BASE_URL}/waste/list`);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500
    });

    apiDuration.add(res.timings.duration);
    if (res.status >= 400) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }
  });
}

export function testIncentiveEndpoint() {
  group('Incentive Endpoint', () => {
    let res = http.get(`${BASE_URL}/incentives/active`);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500
    });

    apiDuration.add(res.timings.duration);
    if (res.status >= 400) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }
  });
}

export function testMetricsEndpoint() {
  group('Metrics Endpoint', () => {
    let res = http.get(`${BASE_URL}/metrics`);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500
    });

    apiDuration.add(res.timings.duration);
    if (res.status >= 400) {
      errorRate.add(1);
    } else {
      successCount.add(1);
    }
  });
}
