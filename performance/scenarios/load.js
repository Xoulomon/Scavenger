import { sleep, group } from 'k6'
import * as common from '../lib/common.js'

export const options = {
  stages: [
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '3m', target: 50 }, // Stay at 50 users
    { duration: '1m', target: 0 } // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01']
  }
}

export default function () {
  const userId = `user_${__VU}_${__ITER}`

  group('Typical User Flow', () => {
    common.registerParticipant(userId)
    sleep(1)
    common.submitWaste(userId)
    sleep(1)
    common.getIncentives()
    sleep(2)
  })
}

export function handleSummary(data) {
  return common.generateReport(data, 'load-test')
}
