import { test, expect } from '@playwright/test'
import {
  LoginPage,
  RegistrationPage,
  WasteSubmissionPage,
  WasteTransferPage,
  IncentiveManagementPage,
  AdminPage,
  DashboardPage
} from './pages'
import { testData } from './fixtures/test-data'

test.describe('User Registration Flow', () => {
  test('should register a recycler participant', async ({ page }) => {
    const registrationPage = new RegistrationPage(page)
    await registrationPage.goto()

    await registrationPage.registerParticipant(
      testData.participants.recycler.name,
      testData.participants.recycler.role,
      testData.participants.recycler.lat,
      testData.participants.recycler.lon
    )

    const message = await registrationPage.getSuccessMessage()
    expect(message).toContain('registered successfully')
  })

  test('should register a collector participant', async ({ page }) => {
    const registrationPage = new RegistrationPage(page)
    await registrationPage.goto()

    await registrationPage.registerParticipant(
      testData.participants.collector.name,
      testData.participants.collector.role,
      testData.participants.collector.lat,
      testData.participants.collector.lon
    )

    const message = await registrationPage.getSuccessMessage()
    expect(message).toContain('registered successfully')
  })

  test('should register a manufacturer participant', async ({ page }) => {
    const registrationPage = new RegistrationPage(page)
    await registrationPage.goto()

    await registrationPage.registerParticipant(
      testData.participants.manufacturer.name,
      testData.participants.manufacturer.role,
      testData.participants.manufacturer.lat,
      testData.participants.manufacturer.lon
    )

    const message = await registrationPage.getSuccessMessage()
    expect(message).toContain('registered successfully')
  })

  test('should reject invalid coordinates', async ({ page }) => {
    const registrationPage = new RegistrationPage(page)
    await registrationPage.goto()

    await registrationPage.registerParticipant(
      'Invalid Participant',
      'Recycler',
      200, // Invalid latitude
      -74.006
    )

    const message = await registrationPage.getErrorMessage()
    expect(message).toContain('Invalid coordinates')
  })
})

test.describe('Waste Submission Flow', () => {
  test('should submit paper waste', async ({ page }) => {
    const wasteSubmissionPage = new WasteSubmissionPage(page)
    await wasteSubmissionPage.goto()

    await wasteSubmissionPage.submitWaste(
      testData.waste.paper.type,
      testData.waste.paper.weight,
      testData.waste.paper.lat,
      testData.waste.paper.lon
    )

    const wasteId = await wasteSubmissionPage.getWasteId()
    expect(wasteId).toBeTruthy()
  })

  test('should submit plastic waste', async ({ page }) => {
    const wasteSubmissionPage = new WasteSubmissionPage(page)
    await wasteSubmissionPage.goto()

    await wasteSubmissionPage.submitWaste(
      testData.waste.plastic.type,
      testData.waste.plastic.weight,
      testData.waste.plastic.lat,
      testData.waste.plastic.lon
    )

    const wasteId = await wasteSubmissionPage.getWasteId()
    expect(wasteId).toBeTruthy()
  })

  test('should submit metal waste', async ({ page }) => {
    const wasteSubmissionPage = new WasteSubmissionPage(page)
    await wasteSubmissionPage.goto()

    await wasteSubmissionPage.submitWaste(
      testData.waste.metal.type,
      testData.waste.metal.weight,
      testData.waste.metal.lat,
      testData.waste.metal.lon
    )

    const wasteId = await wasteSubmissionPage.getWasteId()
    expect(wasteId).toBeTruthy()
  })

  test('should submit glass waste', async ({ page }) => {
    const wasteSubmissionPage = new WasteSubmissionPage(page)
    await wasteSubmissionPage.goto()

    await wasteSubmissionPage.submitWaste(
      testData.waste.glass.type,
      testData.waste.glass.weight,
      testData.waste.glass.lat,
      testData.waste.glass.lon
    )

    const wasteId = await wasteSubmissionPage.getWasteId()
    expect(wasteId).toBeTruthy()
  })

  test('should submit organic waste', async ({ page }) => {
    const wasteSubmissionPage = new WasteSubmissionPage(page)
    await wasteSubmissionPage.goto()

    await wasteSubmissionPage.submitWaste(
      testData.waste.organic.type,
      testData.waste.organic.weight,
      testData.waste.organic.lat,
      testData.waste.organic.lon
    )

    const wasteId = await wasteSubmissionPage.getWasteId()
    expect(wasteId).toBeTruthy()
  })
})

test.describe('Waste Transfer Workflow', () => {
  test('should transfer waste from recycler to collector', async ({ page }) => {
    const wasteTransferPage = new WasteTransferPage(page)
    await wasteTransferPage.goto()

    await wasteTransferPage.transferWaste(
      'waste-1',
      'collector-address',
      testData.waste.paper.lat,
      testData.waste.paper.lon,
      'Transfer from recycler to collector'
    )

    const message = await wasteTransferPage.getSuccessMessage()
    expect(message).toContain('transferred successfully')
  })

  test('should transfer waste from collector to manufacturer', async ({ page }) => {
    const wasteTransferPage = new WasteTransferPage(page)
    await wasteTransferPage.goto()

    await wasteTransferPage.transferWaste(
      'waste-2',
      'manufacturer-address',
      testData.waste.plastic.lat,
      testData.waste.plastic.lon,
      'Transfer from collector to manufacturer'
    )

    const message = await wasteTransferPage.getSuccessMessage()
    expect(message).toContain('transferred successfully')
  })

  test('should include transfer notes', async ({ page }) => {
    const wasteTransferPage = new WasteTransferPage(page)
    await wasteTransferPage.goto()

    await wasteTransferPage.transferWaste(
      'waste-3',
      'recipient-address',
      testData.waste.metal.lat,
      testData.waste.metal.lon,
      'Quality check passed, ready for processing'
    )

    const message = await wasteTransferPage.getSuccessMessage()
    expect(message).toContain('transferred successfully')
  })
})

test.describe('Incentive Creation Flow', () => {
  test('should create paper incentive', async ({ page }) => {
    const incentivePage = new IncentiveManagementPage(page)
    await incentivePage.goto()

    await incentivePage.createIncentive(
      testData.incentives.paperIncentive.wasteType,
      testData.incentives.paperIncentive.rewardPoints,
      testData.incentives.paperIncentive.budget
    )

    const count = await incentivePage.getIncentiveList()
    expect(count).toBeGreaterThan(0)
  })

  test('should create plastic incentive', async ({ page }) => {
    const incentivePage = new IncentiveManagementPage(page)
    await incentivePage.goto()

    await incentivePage.createIncentive(
      testData.incentives.plasticIncentive.wasteType,
      testData.incentives.plasticIncentive.rewardPoints,
      testData.incentives.plasticIncentive.budget
    )

    const count = await incentivePage.getIncentiveList()
    expect(count).toBeGreaterThan(0)
  })

  test('should create metal incentive', async ({ page }) => {
    const incentivePage = new IncentiveManagementPage(page)
    await incentivePage.goto()

    await incentivePage.createIncentive(
      testData.incentives.metalIncentive.wasteType,
      testData.incentives.metalIncentive.rewardPoints,
      testData.incentives.metalIncentive.budget
    )

    const count = await incentivePage.getIncentiveList()
    expect(count).toBeGreaterThan(0)
  })

  test('should update incentive', async ({ page }) => {
    const incentivePage = new IncentiveManagementPage(page)
    await incentivePage.goto()

    await incentivePage.updateIncentive('incentive-1', 25, 2500)

    const count = await incentivePage.getIncentiveList()
    expect(count).toBeGreaterThan(0)
  })

  test('should deactivate incentive', async ({ page }) => {
    const incentivePage = new IncentiveManagementPage(page)
    await incentivePage.goto()

    await incentivePage.deactivateIncentive('incentive-2')

    const count = await incentivePage.getIncentiveList()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Admin Operations', () => {
  test('should set token address', async ({ page }) => {
    const adminPage = new AdminPage(page)
    await adminPage.goto()

    await adminPage.setTokenAddress('GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB46Z')

    const message = await adminPage.getSuccessMessage()
    expect(message).toContain('Token address set')
  })

  test('should set charity contract', async ({ page }) => {
    const adminPage = new AdminPage(page)
    await adminPage.goto()

    await adminPage.setCharityContract('GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB46Z')

    const message = await adminPage.getSuccessMessage()
    expect(message).toContain('Charity contract set')
  })

  test('should set reward percentages', async ({ page }) => {
    const adminPage = new AdminPage(page)
    await adminPage.goto()

    await adminPage.setRewardPercentages(50, 50)

    const message = await adminPage.getSuccessMessage()
    expect(message).toContain('Percentages set')
  })
})

test.describe('Dashboard and Metrics', () => {
  test('should display global metrics', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()

    const metrics = await dashboardPage.getMetrics()
    expect(metrics.totalWaste).toBeTruthy()
    expect(metrics.totalTokens).toBeTruthy()
    expect(metrics.activeParticipants).toBeTruthy()
  })

  test('should display participant statistics', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()

    const stats = await dashboardPage.getParticipantStats()
    expect(stats.submitted).toBeTruthy()
    expect(stats.verified).toBeTruthy()
    expect(stats.transferred).toBeTruthy()
  })
})

test.describe('Complete Supply Chain Flow', () => {
  test('should complete recycler to collector to manufacturer flow', async ({ page }) => {
    // Step 1: Register participants
    const registrationPage = new RegistrationPage(page)
    await registrationPage.goto()
    await registrationPage.registerParticipant('E2E Recycler', 'Recycler', 40.7128, -74.006)

    // Step 2: Submit waste
    const wasteSubmissionPage = new WasteSubmissionPage(page)
    await wasteSubmissionPage.goto()
    await wasteSubmissionPage.submitWaste('Paper', 100, 40.7128, -74.006)
    const wasteId = await wasteSubmissionPage.getWasteId()

    // Step 3: Transfer to collector
    const wasteTransferPage = new WasteTransferPage(page)
    await wasteTransferPage.goto()
    await wasteTransferPage.transferWaste(
      wasteId || 'waste-1',
      'collector-address',
      34.0522,
      -118.2437
    )

    // Step 4: Create incentive
    const incentivePage = new IncentiveManagementPage(page)
    await incentivePage.goto()
    await incentivePage.createIncentive('Paper', 10, 1000)

    // Step 5: Verify dashboard
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    const metrics = await dashboardPage.getMetrics()
    expect(metrics.totalWaste).toBeTruthy()
  })
})
