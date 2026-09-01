const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, 'reports');
const BASELINE_FILE = path.join(__dirname, 'baselines.json');

function generateBaseline() {
  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('-results.json'));

  if (files.length === 0) {
    console.error('No results found in reports directory.');
    return;
  }

  const baseline = {
    timestamp: new Date().toISOString(),
    metrics: {}
  };

  files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8'));
    const testName = file.replace('-results.json', '');

    baseline.metrics[testName] = {
      http_req_duration_p95: data.metrics.http_req_duration.values['p(95)'],
      http_req_duration_avg: data.metrics.http_req_duration.values['avg'],
      iterations_count: data.metrics.iterations.values.count,
      error_rate: data.metrics.errors ? data.metrics.errors.values.rate : 0
    };
  });

  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
  console.log(`Baseline generated at ${BASELINE_FILE}`);
}

generateBaseline();
