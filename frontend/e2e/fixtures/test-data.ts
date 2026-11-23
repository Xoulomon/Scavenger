export const testData = {
  participants: {
    recycler: {
      name: 'Test Recycler',
      role: 'Recycler',
      lat: 40.7128,
      lon: -74.006
    },
    collector: {
      name: 'Test Collector',
      role: 'Collector',
      lat: 34.0522,
      lon: -118.2437
    },
    manufacturer: {
      name: 'Test Manufacturer',
      role: 'Manufacturer',
      lat: 41.8781,
      lon: -87.6298
    }
  },
  waste: {
    paper: {
      type: 'Paper',
      weight: 100,
      lat: 40.7128,
      lon: -74.006
    },
    plastic: {
      type: 'Plastic',
      weight: 50,
      lat: 34.0522,
      lon: -118.2437
    },
    metal: {
      type: 'Metal',
      weight: 200,
      lat: 41.8781,
      lon: -87.6298
    },
    glass: {
      type: 'Glass',
      weight: 75,
      lat: 37.7749,
      lon: -122.4194
    },
    organic: {
      type: 'Organic',
      weight: 150,
      lat: 47.6062,
      lon: -122.3321
    }
  },
  incentives: {
    paperIncentive: {
      wasteType: 'Paper',
      rewardPoints: 10,
      budget: 1000
    },
    plasticIncentive: {
      wasteType: 'Plastic',
      rewardPoints: 15,
      budget: 1500
    },
    metalIncentive: {
      wasteType: 'Metal',
      rewardPoints: 20,
      budget: 2000
    }
  }
}
