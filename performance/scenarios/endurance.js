import { sleep, group } from 'k6'
import * as common from '../lib/common.js'

export const options = {
  stages: [
    { duration: '1m', target: 20 }, // Ramp up
    { duration: '20m', target: 20 }, // Sustained load for a long time (shortened for demo)
    { duration: '1m', target: 0 } // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01']
  }
}

export default function () {
  const userId = `user_${__VU}_${__ITER}`

  group('Endurance Test Flow', () => {
    common.registerParticipant(userId)
    common.submitWaste(userId)
    common.getIncentives()
    sleep(5) // Slow paced to simulate steady use
  })
}

export function handleSummary(data) {
  return common.generateReport(data, 'endurance-test')
}
