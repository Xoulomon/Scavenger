import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '5m', target: 300 },
    { duration: '5m', target: 400 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_req_failed: ['rate<0.2']
  }
}

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000'

  const res = http.get(`${baseUrl}/api/waste?limit=50`)
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1500ms': (r) => r.timings.duration < 1500
  })

  sleep(1)
}
