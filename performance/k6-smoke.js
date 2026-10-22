/**
 * Smoke Test - Quick verification that system is operational
 * Profile: Minimal load with 1 user for quick feedback
 * Duration: ~50 seconds
 * Purpose: Verify basic functionality before running larger tests
 */

import { sleep } from 'k6';
import { getConfig, stages, thresholds, scenarios } from './k6-common.js';

const config = getConfig();

export const options = {
  stages: stages.smoke,
  thresholds: thresholds.smoke,
};

export default function () {
  const vuid = `user_${__VU}_${__ITER}`;

  // Register participant
  scenarios.registerParticipant(config, vuid, 0, 'Recycler');
  sleep(0.5);

  // Submit waste
  scenarios.submitWaste(config, vuid, 0, 100);
  sleep(0.5);

  // Query operations
  scenarios.queryParticipant(config, vuid);
  sleep(0.5);

  scenarios.getGlobalMetrics(config);
  sleep(0.5);
}
