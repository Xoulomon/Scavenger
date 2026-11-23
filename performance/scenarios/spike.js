import { sleep, group } from 'k6'
import * as common from '../lib/common.js'

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Normal load
    { duration: '30s', target: 500 }, // Sudden spike
    { duration: '1m', target: 500 }, // Stay at spike
    { duration: '30s', target: 50 }, // Return to normal
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.1']
  }
}

export default function () {
  const userId = `user_${__VU}_${__ITER}`

  group('Spike Test Flow', () => {
    common.getIncentives()
    common.getMetrics()
    sleep(0.1)
  })
}

export function handleSummary(data) {
  return common.generateReport(data, 'spike-test')
}
