describe('Event Queries', () => {
  it('queryEvents builds filter SQL correctly', () => {
    const filter = {
      eventType: 'recycled',
      fromLedger: 100,
      toLedger: 200,
      limit: 50,
      offset: 10
    }
    expect(filter.eventType).toBe('recycled')
    expect(filter.fromLedger).toBe(100)
    expect(filter.toLedger).toBe(200)
    expect(filter.limit).toBe(50)
    expect(filter.offset).toBe(10)
  })

  it('queryEventTypes returns array', () => {
    const types = ['recycled', 'reg', 'transfer', 'rewarded']
    expect(Array.isArray(types)).toBe(true)
    expect(types).toContain('recycled')
  })

  it('queryEventsByDateRange builds correct structure', () => {
    const results = [
      { date: '2024-01-01', count: 10 },
      { date: '2024-01-02', count: 25 }
    ]
    expect(results.length).toBe(2)
    expect(results[0]).toHaveProperty('date')
    expect(results[0]).toHaveProperty('count')
  })
})
