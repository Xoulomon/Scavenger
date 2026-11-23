import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
    http_req_failed: ['rate<0.1']
  }
}

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000'

  // Test contract invocation gas usage
  const payload = JSON.stringify({
    contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    method: 'register_participant',
    params: {
      address: 'GBRPYHIL2CI3WHZDTOOQFC6EB4RRJC3XVCDTUJ76ZAV2HA72KYHN4A6',
      role: 0,
      name: 'Test Participant',
      latitude: 40,
      longitude: -74
    }
  })

  const res = http.post(`${baseUrl}/api/contract/invoke`, payload, {
    headers: { 'Content-Type': 'application/json' }
  })

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
    'has gas info': (r) => r.body.includes('gas')
  })

  sleep(2)
}
