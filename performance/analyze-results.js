const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, 'reports');
const BASELINES_DIR = path.join(__dirname, 'baselines');
const BASELINE_FILE = path.join(__dirname, 'baselines.json'); // Use the root one
const SUMMARY_REPORT = path.join(__dirname, 'reports', 'performance-summary.md');

function analyze() {
  console.log('Starting Performance Analysis...');

  let baseline = {};
  if (fs.existsSync(BASELINE_FILE)) {
    baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  }

  const results = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('-results.json'));

  let report = '# 🚀 Scavenger Performance Test Report\n\n';
  report += `**Date:** ${new Date().toLocaleString()}\n`;
  report += `**Environment:** ${process.env.BASE_URL || 'Localhost'}\n\n`;

  report += '## 📊 Summary Table\n\n';
  report += '| Test Scenario | p95 Duration | Error Rate | Status |\n';
  report += '|---------------|--------------|------------|--------|\n';

  let totalAlerts = 0;

  results.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8'));
    const testName = file.replace('-results.json', '');

    const p95 = data.metrics.http_req_duration.values['p(95)'];
    const errorRate = data.metrics.errors ? data.metrics.errors.values.rate : 0;

    let status = '🟢 PASS';
    let issues = [];

    // Thresholds
    const MAX_P95 = 1000;
    const MAX_ERROR_RATE = 0.05;

    if (p95 > MAX_P95) {
      status = '🔴 FAIL';
      issues.push(`p95 duration (${p95.toFixed(2)}ms) exceeded threshold (${MAX_P95}ms)`);
    }

    if (errorRate > MAX_ERROR_RATE) {
      status = '🔴 FAIL';
      issues.push(`Error rate (${(errorRate * 100).toFixed(2)}%) exceeded threshold (${(MAX_ERROR_RATE * 100).toFixed(2)}%)`);
    }

    // Baseline Comparison
    if (baseline.api && baseline.api.p95_ms) {
      const baselineP95 = baseline.api.p95_ms.baseline;
      if (p95 > baselineP95 * 1.5) { // 50% degradation
        status = '🟡 WARNING';
        issues.push(`Performance regression: p95 is ${((p95/baselineP95 - 1) * 100).toFixed(1)}% slower than baseline`);
      }
    }

    if (status !== '🟢 PASS') totalAlerts++;

    report += `| ${testName} | ${p95.toFixed(2)}ms | ${(errorRate * 100).toFixed(2)}% | ${status} |\n`;
  });

  report += '\n---\n';
  report += `**Total Alerts Triggered:** ${totalAlerts}\n\n`;

  if (totalAlerts > 0) {
    report += '### ⚠️ Performance Alerts Details\n';
    results.forEach(file => {
        const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8'));
        const testName = file.replace('-results.json', '');
        const p95 = data.metrics.http_req_duration.values['p(95)'];
        const errorRate = data.metrics.errors ? data.metrics.errors.values.rate : 0;

        if (p95 > 1000 || errorRate > 0.05) {
            report += `- **${testName}**: p95=${p95.toFixed(2)}ms, errors=${(errorRate * 100).toFixed(2)}%\n`;
        }
    });
  }

  fs.writeFileSync(SUMMARY_REPORT, report);
  console.log(`Report generated: ${SUMMARY_REPORT}`);

  if (totalAlerts > 0) {
    console.warn(`\n!!! PERFORMANCE ALERTS: ${totalAlerts} issues found !!!\n`);
    process.exit(1);
  } else {
    console.log('\nAll performance tests passed within thresholds.\n');
  }
}

analyze();
