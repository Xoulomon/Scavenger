// Feature: Waste Certification Viewer (#430)
// Tests: isCertificateValid, verifyCertificate, filterCertificates, getCertificateHistory

import { describe, it, expect } from 'vitest'
import { WasteType } from '@/api/types'
import {
  isCertificateValid,
  verifyCertificate,
  filterCertificates,
  getCertificateHistory,
  type WasteCertificate,
  type CertificateHistoryEntry,
} from './WasteCertificationPage'

const NOW = 1_700_000_000

function makeCert(overrides: Partial<WasteCertificate> = {}): WasteCertificate {
  return {
    id: 'CERT-TEST',
    wasteId: 'W-1',
    wasteType: WasteType.Paper,
    weight: 100,
    issuer: 'GISSUER',
    holder: 'GHOLDER',
    issuedAt: NOW - 86400,
    expiresAt: NOW + 86400 * 365,
    status: 'valid',
    blockchainTxId: 'abc123',
    ...overrides,
  }
}

describe('WasteCertificationPage — isCertificateValid', () => {
  it('returns true for a valid, non-expired cert', () => {
    expect(isCertificateValid(makeCert(), NOW)).toBe(true)
  })

  it('returns false for expired cert', () => {
    expect(isCertificateValid(makeCert({ expiresAt: NOW - 1 }), NOW)).toBe(false)
  })

  it('returns false for revoked cert', () => {
    expect(isCertificateValid(makeCert({ status: 'revoked' }), NOW)).toBe(false)
  })

  it('returns false for expired status cert', () => {
    expect(isCertificateValid(makeCert({ status: 'expired' }), NOW)).toBe(false)
  })
})

describe('WasteCertificationPage — verifyCertificate', () => {
  it('returns authentic=true for valid cert', () => {
    const result = verifyCertificate(makeCert(), NOW)
    expect(result.authentic).toBe(true)
  })

  it('returns authentic=false for revoked cert', () => {
    const result = verifyCertificate(makeCert({ status: 'revoked' }), NOW)
    expect(result.authentic).toBe(false)
    expect(result.reason).toMatch(/revoked/i)
  })

  it('returns authentic=false for expired cert', () => {
    const result = verifyCertificate(makeCert({ expiresAt: NOW - 1 }), NOW)
    expect(result.authentic).toBe(false)
    expect(result.reason).toMatch(/expired/i)
  })

  it('returns authentic=false when no blockchain tx', () => {
    const result = verifyCertificate(makeCert({ blockchainTxId: '' }), NOW)
    expect(result.authentic).toBe(false)
  })
})

describe('WasteCertificationPage — filterCertificates', () => {
  const certs: WasteCertificate[] = [
    makeCert({ id: 'CERT-A', status: 'valid', wasteType: WasteType.Paper, holder: 'GHOLDER1' }),
    makeCert({ id: 'CERT-B', status: 'expired', wasteType: WasteType.Metal, holder: 'GHOLDER2' }),
    makeCert({ id: 'CERT-C', status: 'revoked', wasteType: WasteType.Glass, holder: 'GHOLDER3' }),
  ]

  it('returns all when no filter', () => {
    expect(filterCertificates(certs, '', 'all')).toHaveLength(3)
  })

  it('filters by status', () => {
    const result = filterCertificates(certs, '', 'valid')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('CERT-A')
  })

  it('filters by query matching id', () => {
    const result = filterCertificates(certs, 'CERT-B', 'all')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('CERT-B')
  })

  it('filters by query matching holder', () => {
    const result = filterCertificates(certs, 'GHOLDER3', 'all')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('CERT-C')
  })

  it('returns empty when nothing matches', () => {
    expect(filterCertificates(certs, 'ZZZNOMATCH', 'all')).toHaveLength(0)
  })
})

describe('WasteCertificationPage — getCertificateHistory', () => {
  const history: CertificateHistoryEntry[] = [
    { certificateId: 'CERT-A', action: 'issued', actor: 'G1', timestamp: 1000 },
    { certificateId: 'CERT-A', action: 'verified', actor: 'G2', timestamp: 2000 },
    { certificateId: 'CERT-B', action: 'issued', actor: 'G3', timestamp: 3000 },
  ]

  it('returns history for a specific certificate', () => {
    const result = getCertificateHistory(history, 'CERT-A')
    expect(result).toHaveLength(2)
    result.forEach((h) => expect(h.certificateId).toBe('CERT-A'))
  })

  it('returns empty array for unknown certificate', () => {
    expect(getCertificateHistory(history, 'CERT-ZZZ')).toHaveLength(0)
  })
})
