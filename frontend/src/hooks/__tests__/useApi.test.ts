// Feature: Backend/API Integration (#432)
// Tests: useApi client construction, useContractQuery/Mutation wiring

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/context/ContractContext', () => ({
  useContract: () => ({
    config: {
      contractId: 'CTEST123',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      network: 'TESTNET',
    },
    updateConfig: vi.fn(),
  }),
}))

vi.mock('@/lib/stellar', () => ({
  networkConfig: { networkPassphrase: 'Test SDF Network ; September 2015' },
}))

const mockGetParticipant = vi.fn()
const mockSubmitMaterial = vi.fn()

vi.mock('@/api/client', () => ({
  ScavengerClient: vi.fn().mockImplementation(() => ({
    getParticipant: mockGetParticipant,
    submitMaterial: mockSubmitMaterial,
  })),
}))

import { ScavengerClient } from '@/api/client'
import { useApi } from '../useApi'
import { useContractQuery, useContractMutation } from '../useContractQuery'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('constructs a ScavengerClient with config values', () => {
    const { result } = renderHook(() => useApi(), { wrapper: makeWrapper() })
    expect(ScavengerClient).toHaveBeenCalledWith({
      contractId: 'CTEST123',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
    expect(result.current).toBeDefined()
  })

  it('returns the same client instance when config has not changed', () => {
    const { result, rerender } = renderHook(() => useApi(), { wrapper: makeWrapper() })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})

describe('useContractQuery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the provided fn with the client and returns data', async () => {
    const participant = { address: 'GABC', role: 'Recycler', name: 'Alice' }
    mockGetParticipant.mockResolvedValue(participant)

    const { result } = renderHook(
      () => useContractQuery(['participant', 'GABC'], (api) => api.getParticipant('GABC')),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(participant)
    expect(mockGetParticipant).toHaveBeenCalledWith('GABC')
  })

  it('surfaces errors from the client', async () => {
    mockGetParticipant.mockRejectedValue(new Error('Not found.'))

    const { result } = renderHook(
      () =>
        useContractQuery(['participant', 'GBAD'], (api) => api.getParticipant('GBAD'), {
          retry: false,
        }),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('not found')
  })
})

describe('useContractMutation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the provided fn with client and variables', async () => {
    mockSubmitMaterial.mockResolvedValue({ id: 1 })

    const { result } = renderHook(
      () =>
        useContractMutation((api, vars: { submitter: string }) =>
          api.submitMaterial(vars.submitter, 0, 100n, 0n, 0n, vars.submitter)
        ),
      { wrapper: makeWrapper() }
    )

    result.current.mutate({ submitter: 'GABC' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockSubmitMaterial).toHaveBeenCalled()
  })

  it('calls onSuccess callback after successful mutation', async () => {
    mockSubmitMaterial.mockResolvedValue({ id: 2 })
    const onSuccess = vi.fn()

    const { result } = renderHook(
      () =>
        useContractMutation(
          (api, vars: { submitter: string }) =>
            api.submitMaterial(vars.submitter, 0, 100n, 0n, 0n, vars.submitter),
          { onSuccess }
        ),
      { wrapper: makeWrapper() }
    )

    result.current.mutate({ submitter: 'GABC' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(onSuccess).toHaveBeenCalled()
  })
})
