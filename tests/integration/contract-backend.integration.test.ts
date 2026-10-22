import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

describe('Contract-Backend Integration', () => {
  let testUserId: string;

  beforeAll(() => {
    testUserId = `backend_test_${Date.now()}`;
  });

  it('should sync participant data from contract to backend', async () => {
    const userId = `sync_test_${Date.now()}`;

    // Register through API
    await axios.post(`${API_URL}/participants/register`, {
      address: userId,
      role: 'recycler',
      name: 'Sync Test',
      lat: 0,
      lon: 0
    });

    // Verify in backend database
    const response = await axios.get(`${API_URL}/participants/${userId}`);
    expect(response.status).toBe(200);
    expect(response.data.address).toBe(userId);
  });

  it('should handle waste transfer through backend', async () => {
    const recycler = `recycler_${Date.now()}`;
    const collector = `collector_${Date.now()}`;

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
    const transferRes = await axios.post(`${API_URL}/waste/transfer`, {
      waste_id: wasteRes.data.waste_id,
      from: recycler,
      to: collector,
      lat: 0,
      lon: 0,
      note: 'Transfer test'
    });

    expect(transferRes.status).toBe(200);

    // Verify transfer in backend
    const wasteRes2 = await axios.get(`${API_URL}/waste/${wasteRes.data.waste_id}`);
    expect(wasteRes2.data.current_owner).toBe(collector);
  });

  it('should maintain incentive data consistency', async () => {
    const manufacturer = `mfr_${Date.now()}`;

    // Register manufacturer
    await axios.post(`${API_URL}/participants/register`, {
      address: manufacturer,
      role: 'manufacturer',
      name: 'Manufacturer',
      lat: 0,
      lon: 0
    });

    // Create incentive
    const incentiveRes = await axios.post(`${API_URL}/incentives/create`, {
      rewarder: manufacturer,
      waste_type: 'plastic',
      reward_points: 100,
      budget: 1000
    });

    expect(incentiveRes.status).toBe(200);

    // Verify incentive in backend
    const getRes = await axios.get(`${API_URL}/incentives/${incentiveRes.data.incentive_id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data.rewarder).toBe(manufacturer);
  });

  it('should handle batch operations through backend', async () => {
    const submitter = `batch_test_${Date.now()}`;

    // Register
    await axios.post(`${API_URL}/participants/register`, {
      address: submitter,
      role: 'recycler',
      name: 'Batch Test',
      lat: 0,
      lon: 0
    });

    // Batch submit waste
    const materials = [
      { waste_type: 'plastic', weight: 100 },
      { waste_type: 'metal', weight: 50 },
      { waste_type: 'paper', weight: 75 }
    ];

    const batchRes = await axios.post(`${API_URL}/waste/batch-submit`, {
      submitter,
      materials,
      lat: 0,
      lon: 0
    });

    expect(batchRes.status).toBe(200);
    expect(batchRes.data.waste_ids).toHaveLength(3);
  });

  it('should track reward distribution through backend', async () => {
    const recycler = `reward_test_${Date.now()}`;
    const manufacturer = `reward_mfr_${Date.now()}`;

    // Register participants
    await axios.post(`${API_URL}/participants/register`, {
      address: recycler,
      role: 'recycler',
      name: 'Recycler',
      lat: 0,
      lon: 0
    });

    await axios.post(`${API_URL}/participants/register`, {
      address: manufacturer,
      role: 'manufacturer',
      name: 'Manufacturer',
      lat: 0,
      lon: 0
    });

    // Create incentive
    const incentiveRes = await axios.post(`${API_URL}/incentives/create`, {
      rewarder: manufacturer,
      waste_type: 'plastic',
      reward_points: 100,
      budget: 1000
    });

    // Submit waste
    const wasteRes = await axios.post(`${API_URL}/waste/submit`, {
      submitter: recycler,
      waste_type: 'plastic',
      weight: 100,
      lat: 0,
      lon: 0
    });

    // Distribute rewards
    const rewardRes = await axios.post(`${API_URL}/rewards/distribute`, {
      waste_id: wasteRes.data.waste_id,
      incentive_id: incentiveRes.data.incentive_id,
      manufacturer
    });

    expect(rewardRes.status).toBe(200);
  });

  it('should handle error cases gracefully', async () => {
    try {
      await axios.post(`${API_URL}/waste/transfer`, {
        waste_id: 'nonexistent',
        from: 'user1',
        to: 'user2',
        lat: 0,
        lon: 0,
        note: 'Test'
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.response?.status).toBe(404);
    }
  });

  it('should maintain transaction integrity', async () => {
    const userId = `integrity_test_${Date.now()}`;

    // Register
    await axios.post(`${API_URL}/participants/register`, {
      address: userId,
      role: 'recycler',
      name: 'Integrity Test',
      lat: 0,
      lon: 0
    });

    // Submit multiple wastes
    const wasteIds = [];
    for (let i = 0; i < 3; i++) {
      const res = await axios.post(`${API_URL}/waste/submit`, {
        submitter: userId,
        waste_type: 'plastic',
        weight: 100 + i * 10,
        lat: 0,
        lon: 0
      });
      wasteIds.push(res.data.waste_id);
    }

    // Verify all wastes are associated with user
    const statsRes = await axios.get(`${API_URL}/participants/${userId}/stats`);
    expect(statsRes.data.total_waste_submitted).toBe(3);
  });
});
