import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    http_req_failed: ['rate<0.1']
  }
}

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000'

  // Test waste submission endpoint
  const payload = JSON.stringify({
    wasteType: 'plastic',
    weight: 10,
    latitude: 40.7128,
    longitude: -74.006
  })

  const res = http.post(`${baseUrl}/api/waste/submit`, payload, {
    headers: { 'Content-Type': 'application/json' }
  })

  check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'response time < 800ms': (r) => r.timings.duration < 800
  })

  sleep(1)
}
