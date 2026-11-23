import { sleep, group } from 'k6'
import * as common from '../lib/common.js'

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 400 },
    { duration: '2m', target: 500 }, // Break point?
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Higher tolerance for stress test
    errors: ['rate<0.05']
  }
}

export default function () {
  const userId = `user_${__VU}_${__ITER}`

  group('Stress Test Flow', () => {
    common.registerParticipant(userId)
    common.submitWaste(userId)
    common.getIncentives()
    sleep(0.5)
  })
}

export function handleSummary(data) {
  return common.generateReport(data, 'stress-test')
}
