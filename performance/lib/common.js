import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

export const errorRate = new Rate('errors')
export const apiDuration = new Trend('api_duration')
export const successCount = new Counter('success_count')
export const failureCount = new Counter('failure_count')

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api'

export function registerParticipant(userId) {
  const payload = JSON.stringify({
    address: userId,
    role: 'recycler',
    name: `Test User ${userId}`,
    lat: 40.7128,
    lon: -74.006
  })

  const res = http.post(`${BASE_URL}/participants/register`, payload, {
    headers: { 'Content-Type': 'application/json' }
  })

  const isSuccessful = check(res, {
    'register status is 200 or 409': (r) => r.status === 200 || r.status === 409,
    'register response time < 500ms': (r) => r.timings.duration < 500
  })

  apiDuration.add(res.timings.duration)
  if (isSuccessful) {
    successCount.add(1)
  } else {
    failureCount.add(1)
    errorRate.add(1)
  }
  return res
}

export function submitWaste(userId) {
  const payload = JSON.stringify({
    submitter: userId,
    waste_type: 'plastic',
    weight: Math.floor(Math.random() * 100) + 1,
    lat: 40.7128,
    lon: -74.006
  })

  const res = http.post(`${BASE_URL}/waste/submit`, payload, {
    headers: { 'Content-Type': 'application/json' }
  })

  const isSuccessful = check(res, {
    'submit waste status is 200': (r) => r.status === 200,
    'submit response time < 800ms': (r) => r.timings.duration < 800
  })

  apiDuration.add(res.timings.duration)
  if (isSuccessful) {
    successCount.add(1)
  } else {
    failureCount.add(1)
    errorRate.add(1)
  }
  return res
}

export function getIncentives() {
  const res = http.get(`${BASE_URL}/incentives/active`)

  const isSuccessful = check(res, {
    'get incentives status is 200': (r) => r.status === 200,
    'get incentives response time < 300ms': (r) => r.timings.duration < 300
  })

  apiDuration.add(res.timings.duration)
  if (isSuccessful) {
    successCount.add(1)
  } else {
    failureCount.add(1)
    errorRate.add(1)
  }
  return res
}

export function getMetrics() {
  const res = http.get(`${BASE_URL}/metrics`)

  const isSuccessful = check(res, {
    'get metrics status is 200': (r) => r.status === 200,
    'get metrics response time < 500ms': (r) => r.timings.duration < 500
  })

  apiDuration.add(res.timings.duration)
  if (isSuccessful) {
    successCount.add(1)
  } else {
    failureCount.add(1)
    errorRate.add(1)
  }
  return res
}

export function generateReport(data, testName) {
  return {
    stdout: `Test ${testName} completed.\n`,
    [`performance/reports/${testName}-results.json`]: JSON.stringify(data)
  }
}
