/**
 * Stress Test - Find system breaking point through gradual load increase
 * Profile: Gradual increase from 1000 to 10000 concurrent users
 * Duration: ~15 minutes
 * Purpose: Identify system limits and breaking points
 * Thresholds: p95 < 2000ms, error rate < 10%
 * WARNING: This test is resource-intensive; use staging environment
 */

import { sleep } from 'k6';
import { getConfig, stages, thresholds, scenarios, metrics } from './k6-common.js';

const config = getConfig();

export const options = {
  stages: stages.stress,
  thresholds: thresholds.stress,
};

export default function () {
  const vuid = `stress_user_${__VU}_${__ITER}`;
  const isRegistrationStage = __ITER % 5 === 0;
  const isWasteOperationStage = __ITER % 3 === 0;

  metrics.activeConnections.add(__VU);

  // Registration phase (20% of iterations)
  if (isRegistrationStage && __VU < 5000) {
    scenarios.registerParticipant(config, vuid, Math.floor(Math.random() * 3), 'StressUser');
    sleep(0.2);
  }

  // Waste operations (40% of iterations)
  if (isWasteOperationStage && __VU < 8000) {
    scenarios.submitWaste(config, vuid, Math.floor(Math.random() * 5), 75 + Math.random() * 150);
    sleep(0.2);
  }

  // Query operations (always run, 100% of iterations)
  scenarios.queryParticipant(config, vuid);
  sleep(0.1);

  // Frequent query operations to stress the system
  if (__VU > 3000) {
    scenarios.queryWaste(config, `waste_${Math.floor(__ITER / 10)}`);
    sleep(0.1);
  }

  // Metrics queries increase as load increases
  if (__VU > 5000 && __ITER % 50 === 0) {
    scenarios.getGlobalMetrics(config);
  }

  sleep(0.5);
}
