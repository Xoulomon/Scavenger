/**
 * Spike Test - Sudden traffic increase to test system response
 * Profile: 100 users → 1000 users spike → back to 100 users
 * Duration: ~6 minutes
 * Purpose: Verify system handles sudden traffic bursts
 * Thresholds: p95 < 2000ms, error rate < 15%
 */

import { sleep } from 'k6';
import { getConfig, stages, thresholds, scenarios, metrics } from './k6-common.js';

const config = getConfig();

export const options = {
  stages: stages.spike,
  thresholds: thresholds.spike,
};

export default function () {
  const vuid = `spike_user_${__VU}_${__ITER}`;
  const spikePhase = __VU > 100; // Spike when VU exceeds base load

  metrics.activeConnections.add(__VU);

  // Light operations before spike
  if (!spikePhase) {
    scenarios.registerParticipant(config, vuid, 0, 'BaseUser');
    sleep(1);
  } else {
    // During spike: quick operations
    scenarios.submitWaste(config, vuid, Math.floor(Math.random() * 5), 50 + Math.random() * 100);
    sleep(0.1);

    scenarios.queryParticipant(config, vuid);
    sleep(0.1);

    // More frequent queries during spike
    scenarios.queryWaste(config, `waste_${__ITER}`);
    sleep(0.1);

    // Check metrics during spike
    if (__ITER % 10 === 0) {
      scenarios.getGlobalMetrics(config);
    }

    sleep(0.5);
  }
}
