import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock jsPDF and triggerDownload so PDF tests don't need a real DOM ─────────

const mockOutput = vi.fn(() => new Blob())
const mockText = vi.fn()
const mockSetFontSize = vi.fn()
const mockSetTextColor = vi.fn()

vi.mock('jspdf', () => {
  class jsPDF {
    text = mockText
    setFontSize = mockSetFontSize
    setTextColor = mockSetTextColor
    output = mockOutput
  }
  return { jsPDF }
})

vi.mock('@/lib/exportImport', () => ({
  triggerDownload: vi.fn()
}))

import {
  CharityStorage,
  REGISTERED_CHARITIES,
  generateDonationReceipt,
  CharityDonation
} from '@/lib/charityStorage'
import { triggerDownload } from '@/lib/exportImport'

const ADDR = 'GDONOR123'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('REGISTERED_CHARITIES', () => {
  it('contains at least 4 charities', () => {
    expect(REGISTERED_CHARITIES.length).toBeGreaterThanOrEqual(4)
  })

  it('each charity has required fields', () => {
    for (const c of REGISTERED_CHARITIES) {
      expect(c.id).toBeTruthy()
      expect(c.name).toBeTruthy()
      expect(c.description).toBeTruthy()
      expect(c.category).toBeTruthy()
      expect(c.address).toBeTruthy()
    }
  })
})

describe('CharityStorage', () => {
  it('returns empty array when no donations recorded', () => {
    const store = new CharityStorage(ADDR)
    expect(store.getAll()).toEqual([])
  })

  it('records a donation and returns it', () => {
    const store = new CharityStorage(ADDR)
    const entry = store.record({
      charityId: 'eco-foundation',
      charityName: 'Eco Foundation',
      donorAddress: ADDR,
      wasteItemIds: [1, 2],
      tokenAmount: 500n
    })
    expect(entry.id).toMatch(/^don_/)
    expect(entry.receiptNumber).toMatch(/^RCP-/)
    expect(entry.tokenAmount).toBe(500n)
    expect(store.getAll()).toHaveLength(1)
  })

  it('persists BigInt tokenAmount across serialisation round-trip', () => {
    const store = new CharityStorage(ADDR)
    store.record({
      charityId: 'eco-foundation',
      charityName: 'Eco Foundation',
      donorAddress: ADDR,
      wasteItemIds: [],
      tokenAmount: 9_007_199_254_740_993n // > Number.MAX_SAFE_INTEGER
    })
    const loaded = new CharityStorage(ADDR).getAll()
    expect(loaded[0].tokenAmount).toBe(9_007_199_254_740_993n)
  })

  it('stores multiple donations in descending order', () => {
    const store = new CharityStorage(ADDR)
    store.record({
      charityId: 'a',
      charityName: 'A',
      donorAddress: ADDR,
      wasteItemIds: [],
      tokenAmount: 100n
    })
    store.record({
      charityId: 'b',
      charityName: 'B',
      donorAddress: ADDR,
      wasteItemIds: [],
      tokenAmount: 200n
    })
    const all = store.getAll()
    expect(all).toHaveLength(2)
    // Most recent first
    expect(all[0].charityName).toBe('B')
  })

  it('isolates donations per donor address', () => {
    new CharityStorage(ADDR).record({
      charityId: 'eco-foundation',
      charityName: 'Eco',
      donorAddress: ADDR,
      wasteItemIds: [],
      tokenAmount: 50n
    })
    const other = new CharityStorage('GOTHER456')
    expect(other.getAll()).toHaveLength(0)
  })
})

describe('generateDonationReceipt', () => {
  it('calls triggerDownload with a PDF blob', () => {
    const donation: CharityDonation = {
      id: 'don_1',
      charityId: 'eco-foundation',
      charityName: 'Eco Foundation',
      donorAddress: ADDR,
      wasteItemIds: [3],
      tokenAmount: 250n,
      timestamp: Date.now(),
      receiptNumber: 'RCP-ABC123'
    }
    generateDonationReceipt(donation, ADDR)
    expect(triggerDownload).toHaveBeenCalledOnce()
    const [, filename] = (triggerDownload as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(filename).toContain('RCP-ABC123')
    expect(filename).toMatch(/\.pdf$/)
  })
})
