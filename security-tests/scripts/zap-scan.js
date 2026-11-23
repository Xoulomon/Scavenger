#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const API_URL = process.env.API_URL || 'http://localhost:3000/api'
const ZAP_PORT = process.env.ZAP_PORT || 8080
const REPORT_DIR = path.join(__dirname, '../reports')

// Ensure reports directory exists
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
}

console.log('🔒 Starting OWASP ZAP Security Scan...')
console.log(`Target: ${API_URL}`)

// Check if ZAP is available
try {
  execSync('which zaproxy || which zap.sh', { stdio: 'ignore' })
} catch {
  console.warn('⚠️  OWASP ZAP not found. Install it to run automated scans.')
  console.log('Visit: https://www.zaproxy.org/download/')
  process.exit(0)
}

// Run ZAP scan
const scanCommand = `
  zaproxy -cmd \
    -quickurl ${API_URL} \
    -quickout ${path.join(REPORT_DIR, 'zap-report.html')}
`

try {
  console.log('Running ZAP scan...')
  execSync(scanCommand, { stdio: 'inherit' })
  console.log('✅ ZAP scan completed')
  console.log(`📊 Report saved to: ${path.join(REPORT_DIR, 'zap-report.html')}`)
} catch (error) {
  console.error('❌ ZAP scan failed:', error.message)
  process.exit(1)
}
