import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 30 },
    { duration: '2m', target: 100 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<600', 'p(99)<1200'],
    http_req_failed: ['rate<0.05']
  }
}

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000'

  // Test database query performance
  const res = http.get(`${baseUrl}/api/waste?limit=100&offset=0`)
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 600ms': (r) => r.timings.duration < 600,
    'has data': (r) => r.body.includes('waste')
  })

  sleep(1)
}
