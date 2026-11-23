import { describe, it, expect } from 'vitest'
import {
  ContractError,
  TransactionError,
  SigningError,
  NetworkError,
  TimeoutError
} from '../src/errors'

describe('ContractError', () => {
  it('creates error with message and optional code', () => {
    const err = new ContractError('Test error', 42)
    expect(err.message).toBe('Test error')
    expect(err.code).toBe(42)
    expect(err.name).toBe('ContractError')
  })

  it('creates error without code', () => {
    const err = new ContractError('No code')
    expect(err.code).toBeUndefined()
  })
})

describe('TransactionError', () => {
  it('creates error with tx hash and result XDR', () => {
    const err = new TransactionError('Failed', 'abc123', 'xdrdata')
    expect(err.message).toBe('Failed')
    expect(err.txHash).toBe('abc123')
    expect(err.resultXdr).toBe('xdrdata')
  })
})

describe('SigningError', () => {
  it('creates signing error', () => {
    const err = new SigningError('User rejected')
    expect(err.name).toBe('SigningError')
  })
})

describe('NetworkError', () => {
  it('creates network error with RPC URL', () => {
    const err = new NetworkError('Connection failed', 'http://localhost')
    expect(err.rpcUrl).toBe('http://localhost')
  })
})

describe('TimeoutError', () => {
  it('creates timeout error', () => {
    const err = new TimeoutError('Timed out')
    expect(err.name).toBe('TimeoutError')
  })
})
