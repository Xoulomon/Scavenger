import { Page, expect } from '@playwright/test'

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/')
  }

  async login(email: string, password: string) {
    await this.page.fill('input[type="email"]', email)
    await this.page.fill('input[type="password"]', password)
    await this.page.click('button:has-text("Sign In")')
    await this.page.waitForNavigation()
  }

  async isLoggedIn() {
    return await this.page.isVisible('text=Dashboard')
  }
}

export class RegistrationPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/register')
  }

  async registerParticipant(name: string, role: string, lat: number, lon: number) {
    await this.page.fill('input[name="name"]', name)
    await this.page.selectOption('select[name="role"]', role)
    await this.page.fill('input[name="latitude"]', lat.toString())
    await this.page.fill('input[name="longitude"]', lon.toString())
    await this.page.click('button:has-text("Register")')
    await this.page.waitForNavigation()
  }

  async getSuccessMessage() {
    return await this.page.textContent('.success-message')
  }

  async getErrorMessage() {
    return await this.page.textContent('.error-message')
  }
}

export class WasteSubmissionPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/submit-waste')
  }

  async submitWaste(wasteType: string, weight: number, lat: number, lon: number) {
    await this.page.selectOption('select[name="wasteType"]', wasteType)
    await this.page.fill('input[name="weight"]', weight.toString())
    await this.page.fill('input[name="latitude"]', lat.toString())
    await this.page.fill('input[name="longitude"]', lon.toString())
    await this.page.click('button:has-text("Submit")')
    await this.page.waitForNavigation()
  }

  async getWasteId() {
    return await this.page.textContent('[data-testid="waste-id"]')
  }
}

export class WasteTransferPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/transfer-waste')
  }

  async transferWaste(
    wasteId: string,
    recipientAddress: string,
    lat: number,
    lon: number,
    note?: string
  ) {
    await this.page.fill('input[name="wasteId"]', wasteId)
    await this.page.fill('input[name="recipient"]', recipientAddress)
    await this.page.fill('input[name="latitude"]', lat.toString())
    await this.page.fill('input[name="longitude"]', lon.toString())
    if (note) {
      await this.page.fill('textarea[name="note"]', note)
    }
    await this.page.click('button:has-text("Transfer")')
    await this.page.waitForNavigation()
  }

  async getSuccessMessage() {
    return await this.page.textContent('.success-message')
  }
}

export class IncentiveManagementPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/incentives')
  }

  async createIncentive(wasteType: string, rewardPoints: number, budget: number) {
    await this.page.click('button:has-text("Create Incentive")')
    await this.page.selectOption('select[name="wasteType"]', wasteType)
    await this.page.fill('input[name="rewardPoints"]', rewardPoints.toString())
    await this.page.fill('input[name="budget"]', budget.toString())
    await this.page.click('button:has-text("Create")')
    await this.page.waitForNavigation()
  }

  async updateIncentive(incentiveId: string, rewardPoints: number, budget: number) {
    await this.page.click(`[data-testid="edit-${incentiveId}"]`)
    await this.page.fill('input[name="rewardPoints"]', rewardPoints.toString())
    await this.page.fill('input[name="budget"]', budget.toString())
    await this.page.click('button:has-text("Update")')
    await this.page.waitForNavigation()
  }

  async deactivateIncentive(incentiveId: string) {
    await this.page.click(`[data-testid="deactivate-${incentiveId}"]`)
    await this.page.click('button:has-text("Confirm")')
    await this.page.waitForNavigation()
  }

  async getIncentiveList() {
    return await this.page.locator('[data-testid="incentive-item"]').count()
  }
}

export class AdminPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin')
  }

  async setTokenAddress(tokenAddress: string) {
    await this.page.fill('input[name="tokenAddress"]', tokenAddress)
    await this.page.click('button:has-text("Set Token Address")')
    await this.page.waitForNavigation()
  }

  async setCharityContract(charityAddress: string) {
    await this.page.fill('input[name="charityAddress"]', charityAddress)
    await this.page.click('button:has-text("Set Charity Contract")')
    await this.page.waitForNavigation()
  }

  async setRewardPercentages(collectorPct: number, ownerPct: number) {
    await this.page.fill('input[name="collectorPct"]', collectorPct.toString())
    await this.page.fill('input[name="ownerPct"]', ownerPct.toString())
    await this.page.click('button:has-text("Set Percentages")')
    await this.page.waitForNavigation()
  }

  async getSuccessMessage() {
    return await this.page.textContent('.success-message')
  }
}

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard')
  }

  async getMetrics() {
    return {
      totalWaste: await this.page.textContent('[data-testid="total-waste"]'),
      totalTokens: await this.page.textContent('[data-testid="total-tokens"]'),
      activeParticipants: await this.page.textContent('[data-testid="active-participants"]')
    }
  }

  async getParticipantStats() {
    return {
      submitted: await this.page.textContent('[data-testid="waste-submitted"]'),
      verified: await this.page.textContent('[data-testid="waste-verified"]'),
      transferred: await this.page.textContent('[data-testid="waste-transferred"]')
    }
  }
}
