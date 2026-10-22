import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const CONTRACT_ID = process.env.CONTRACT_ID || 'test-contract-id';

describe('Contract-Frontend Integration', () => {
  let testUserId: string;

  beforeAll(() => {
    testUserId = `test_user_${Date.now()}`;
  });

  it('should register participant through frontend API', async () => {
    const response = await axios.post(`${API_URL}/participants/register`, {
      address: testUserId,
      role: 'recycler',
      name: 'Test User',
      lat: 0,
      lon: 0
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('address', testUserId);
  });

  it('should retrieve participant data from contract', async () => {
    const response = await axios.get(`${API_URL}/participants/${testUserId}`);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('address', testUserId);
    expect(response.data).toHaveProperty('role');
  });

  it('should submit waste through frontend and verify on contract', async () => {
    const wasteResponse = await axios.post(`${API_URL}/waste/submit`, {
      submitter: testUserId,
      waste_type: 'plastic',
      weight: 100,
      lat: 0,
      lon: 0
    });

    expect(wasteResponse.status).toBe(200);
    expect(wasteResponse.data).toHaveProperty('waste_id');

    const wasteId = wasteResponse.data.waste_id;

    // Verify waste on contract
    const getResponse = await axios.get(`${API_URL}/waste/${wasteId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data).toHaveProperty('waste_id', wasteId);
  });

  it('should handle participant role updates', async () => {
    const updateResponse = await axios.put(`${API_URL}/participants/${testUserId}/role`, {
      new_role: 'collector'
    });

    expect(updateResponse.status).toBe(200);

    // Verify role change
    const getResponse = await axios.get(`${API_URL}/participants/${testUserId}`);
    expect(getResponse.data).toHaveProperty('role', 'collector');
  });

  it('should track participant statistics', async () => {
    const statsResponse = await axios.get(`${API_URL}/participants/${testUserId}/stats`);

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.data).toHaveProperty('total_waste_submitted');
    expect(statsResponse.data).toHaveProperty('total_waste_verified');
  });

  it('should handle concurrent participant registrations', async () => {
    const registrations = Array(5).fill(null).map((_, i) =>
      axios.post(`${API_URL}/participants/register`, {
        address: `concurrent_user_${i}_${Date.now()}`,
        role: 'recycler',
        name: `Concurrent User ${i}`,
        lat: 0,
        lon: 0
      })
    );

    const results = await Promise.all(registrations);
    results.forEach(result => {
      expect(result.status).toBe(200);
    });
  });

  it('should maintain data consistency across multiple operations', async () => {
    const userId = `consistency_test_${Date.now()}`;

    // Register
    await axios.post(`${API_URL}/participants/register`, {
      address: userId,
      role: 'recycler',
      name: 'Consistency Test',
      lat: 0,
      lon: 0
    });

    // Submit waste
    const wasteRes = await axios.post(`${API_URL}/waste/submit`, {
      submitter: userId,
      waste_type: 'metal',
      weight: 50,
      lat: 0,
      lon: 0
    });

    // Verify consistency
    const participantRes = await axios.get(`${API_URL}/participants/${userId}`);
    const wasteRes2 = await axios.get(`${API_URL}/waste/${wasteRes.data.waste_id}`);

    expect(participantRes.data.address).toBe(userId);
    expect(wasteRes2.data.submitter).toBe(userId);
  });
});
