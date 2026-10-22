/**
 * Load Test - Steady state load to verify sustained performance
 * Profile: 100 concurrent users for extended duration
 * Duration: ~6 minutes
 * Purpose: Baseline performance under normal sustained load
 * Thresholds: p95 < 1000ms, error rate < 5%
 */

import { sleep } from 'k6';
import { getConfig, stages, thresholds, scenarios } from './k6-common.js';

const config = getConfig();

export const options = {
  stages: stages.load,
  thresholds: thresholds.load,
};

export default function () {
  const vuid = `load_user_${__VU}_${__ITER}`;

  // Participant registration (10% of iterations)
  if (__ITER % 10 === 0) {
    scenarios.registerParticipant(config, vuid, Math.floor(Math.random() * 3), 'TestUser');
    sleep(0.5);
  }

  // Waste submission (30% of iterations)
  if (__ITER % 3 === 0) {
    scenarios.submitWaste(config, vuid, Math.floor(Math.random() * 5), 50 + Math.random() * 100);
    sleep(0.5);
  }

  // Query operations (60% of iterations)
  scenarios.queryParticipant(config, vuid);
  sleep(0.3);

  scenarios.queryWaste(config, `waste_${__ITER}`);
  sleep(0.3);

  // Global metrics (every 100 iterations)
  if (__ITER % 100 === 0) {
    scenarios.getGlobalMetrics(config);
  }

  sleep(1);
}
