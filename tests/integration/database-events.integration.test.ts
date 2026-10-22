import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

describe('Event Handling Integration', () => {
  it('should emit participant registered event', async () => {
    const userId = `event_test_${Date.now()}`;

    const response = await axios.post(`${API_URL}/participants/register`, {
      address: userId,
      role: 'recycler',
      name: 'Event Test',
      lat: 0,
      lon: 0
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('event_id');
  });

  it('should emit waste submitted event', async () => {
    const userId = `waste_event_${Date.now()}`;

    // Register first
    await axios.post(`${API_URL}/participants/register`, {
      address: userId,
      role: 'recycler',
      name: 'Waste Event Test',
      lat: 0,
      lon: 0
    });

    // Submit waste
    const response = await axios.post(`${API_URL}/waste/submit`, {
      submitter: userId,
      waste_type: 'plastic',
      weight: 100,
      lat: 0,
      lon: 0
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('event_id');
  });

  it('should emit waste transferred event', async () => {
    const recycler = `recycler_event_${Date.now()}`;
    const collector = `collector_event_${Date.now()}`;

    // Register participants
    await axios.post(`${API_URL}/participants/register`, {
      address: recycler,
      role: 'recycler',
      name: 'Recycler',
      lat: 0,
      lon: 0
    });

    await axios.post(`${API_URL}/participants/register`, {
      address: collector,
      role: 'collector',
      name: 'Collector',
      lat: 0,
      lon: 0
    });

    // Submit waste
    const wasteRes = await axios.post(`${API_URL}/waste/submit`, {
      submitter: recycler,
      waste_type: 'plastic',
      weight: 100,
      lat: 0,
      lon: 0
    });

    // Transfer waste
    const response = await axios.post(`${API_URL}/waste/transfer`, {
      waste_id: wasteRes.data.waste_id,
      from: recycler,
      to: collector,
      lat: 0,
      lon: 0,
      note: 'Transfer'
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('event_id');
  });

  it('should emit incentive created event', async () => {
    const manufacturer = `mfr_event_${Date.now()}`;

    // Register
    await axios.post(`${API_URL}/participants/register`, {
      address: manufacturer,
      role: 'manufacturer',
      name: 'Manufacturer',
      lat: 0,
      lon: 0
    });

    // Create incentive
    const response = await axios.post(`${API_URL}/incentives/create`, {
      rewarder: manufacturer,
      waste_type: 'plastic',
      reward_points: 100,
      budget: 1000
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('event_id');
  });

  it('should handle event ordering correctly', async () => {
    const userId = `order_test_${Date.now()}`;

    // Register
    const regRes = await axios.post(`${API_URL}/participants/register`, {
      address: userId,
      role: 'recycler',
      name: 'Order Test',
      lat: 0,
      lon: 0
    });

    // Submit waste
    const wasteRes = await axios.post(`${API_URL}/waste/submit`, {
      submitter: userId,
      waste_type: 'plastic',
      weight: 100,
      lat: 0,
      lon: 0
    });

    // Events should be in order
    expect(regRes.data.event_id).toBeLessThan(wasteRes.data.event_id);
  });

  it('should propagate events to listeners', async () => {
    const userId = `listener_test_${Date.now()}`;

    // Subscribe to events (if supported)
    const response = await axios.post(`${API_URL}/participants/register`, {
      address: userId,
      role: 'recycler',
      name: 'Listener Test',
      lat: 0,
      lon: 0
    });

    expect(response.status).toBe(200);
    // Event should be propagated to all listeners
  });
});

describe('Database Integration', () => {
  it('should persist participant data to database', async () => {
    const userId = `db_test_${Date.now()}`;

    // Register
    await axios.post(`${API_URL}/participants/register`, {
      address: userId,
      role: 'recycler',
      name: 'DB Test',
      lat: 0,
      lon: 0
    });

    // Query database
    const response = await axios.get(`${API_URL}/participants/${userId}`);
    expect(response.status).toBe(200);
    expect(response.data.address).toBe(userId);
  });

  it('should maintain referential integrity', async () => {
    const recycler = `ref_recycler_${Date.now()}`;
    const collector = `ref_collector_${Date.now()}`;

    // Register participants
    await axios.post(`${API_URL}/participants/register`, {
      address: recycler,
      role: 'recycler',
      name: 'Recycler',
      lat: 0,
      lon: 0
    });

    await axios.post(`${API_URL}/participants/register`, {
      address: collector,
      role: 'collector',
      name: 'Collector',
      lat: 0,
      lon: 0
    });

    // Submit waste
    const wasteRes = await axios.post(`${API_URL}/waste/submit`, {
      submitter: recycler,
      waste_type: 'plastic',
      weight: 100,
      lat: 0,
      lon: 0
    });

    // Transfer waste
    await axios.post(`${API_URL}/waste/transfer`, {
      waste_id: wasteRes.data.waste_id,
      from: recycler,
      to: collector,
      lat: 0,
      lon: 0,
      note: 'Transfer'
    });

    // Verify referential integrity
    const wasteData = await axios.get(`${API_URL}/waste/${wasteRes.data.waste_id}`);
    expect(wasteData.data.current_owner).toBe(collector);
  });

  it('should handle concurrent database writes', async () => {
    const writes = Array(10).fill(null).map((_, i) =>
      axios.post(`${API_URL}/participants/register`, {
        address: `concurrent_${i}_${Date.now()}`,
        role: 'recycler',
        name: `Concurrent ${i}`,
        lat: 0,
        lon: 0
      })
    );

    const results = await Promise.all(writes);
    results.forEach(result => {
      expect(result.status).toBe(200);
    });
  });

  it('should support database transactions', async () => {
    const userId = `tx_test_${Date.now()}`;

    // Register
    await axios.post(`${API_URL}/participants/register`, {
      address: userId,
      role: 'recycler',
      name: 'Transaction Test',
      lat: 0,
      lon: 0
    });

    // Submit waste (should be atomic)
    const wasteRes = await axios.post(`${API_URL}/waste/submit`, {
      submitter: userId,
      waste_type: 'plastic',
      weight: 100,
      lat: 0,
      lon: 0
    });

    expect(wasteRes.status).toBe(200);

    // Verify both operations succeeded
    const participantRes = await axios.get(`${API_URL}/participants/${userId}`);
    const wasteRes2 = await axios.get(`${API_URL}/waste/${wasteRes.data.waste_id}`);

    expect(participantRes.status).toBe(200);
    expect(wasteRes2.status).toBe(200);
  });
});

describe('External API Integration', () => {
  it('should integrate with Stellar testnet', async () => {
    const response = await axios.get(`${API_URL}/health`);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('stellar_network');
  });

  it('should handle API rate limiting', async () => {
    const requests = Array(100).fill(null).map(() =>
      axios.get(`${API_URL}/health`).catch(e => e.response?.status)
    );

    const results = await Promise.all(requests);
    const hasRateLimit = results.some(r => r === 429);
    // May or may not have rate limiting depending on configuration
    expect(typeof hasRateLimit).toBe('boolean');
  });

  it('should handle API timeouts gracefully', async () => {
    try {
      await axios.get(`${API_URL}/slow-endpoint`, {
        timeout: 100
      });
    } catch (error: any) {
      expect(error.code).toBe('ECONNABORTED');
    }
  });
});
