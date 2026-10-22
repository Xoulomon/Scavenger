/**
 * Soak Test - Sustained moderate load to detect memory leaks and degradation
 * Profile: 500 concurrent users for 40 minutes
 * Duration: ~40 minutes (extended test)
 * Purpose: Detect resource leaks, connection issues, and performance degradation
 * Thresholds: p95 < 500ms, error rate < 5%
 * WARNING: This is a long-running test; use for CI overnight or scheduled runs
 */

import { sleep } from 'k6';
import { getConfig, stages, thresholds, scenarios, metrics } from './k6-common.js';

const config = getConfig();

export const options = {
  stages: stages.soak,
  thresholds: thresholds.soak,
};

export default function () {
  const vuid = `soak_user_${__VU}_${__ITER}`;

  metrics.activeConnections.add(__VU);

  // Realistic user behavior pattern during soak test
  const operationType = __ITER % 100;

  if (operationType < 10) {
    // 10% registration
    scenarios.registerParticipant(config, vuid, Math.floor(Math.random() * 3), 'SoakUser');
  } else if (operationType < 40) {
    // 30% waste operations
    scenarios.submitWaste(config, vuid, Math.floor(Math.random() * 5), 50 + Math.random() * 100);
  } else if (operationType < 90) {
    // 50% queries
    scenarios.queryParticipant(config, vuid);
    sleep(0.2);
    scenarios.queryWaste(config, `waste_${Math.floor(__ITER / 1000)}`);
  } else {
    // 10% metrics queries
    scenarios.getGlobalMetrics(config);
  }

  // Varied sleep to simulate realistic user behavior
  sleep(0.5 + Math.random() * 1.5);
}
