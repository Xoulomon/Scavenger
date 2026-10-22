import {
  AppError,
  ValidationError,
  DatabaseError,
  NotFoundError,
  NetworkError,
  handleError,
  isAppError,
  ErrorCode,
} from '../../src/errors/AppError'
import { ErrorCode as SharedErrorCode } from '@scavngr/sdk'

describe('AppError', () => {
  it('exposes the shared ErrorCode enum', () => {
    // The indexer re-exports the SDK's enum — they must be the same object.
    expect(ErrorCode).toBe(SharedErrorCode)
  })

  it('serialises to the shared envelope shape', () => {
    const err = new ValidationError('bad input', { field: 'x' })
    expect(err.toJSON()).toEqual({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'bad input',
      statusCode: 400,
      details: { field: 'x' },
    })
  })

  it.each([
    [new ValidationError('v'), ErrorCode.VALIDATION_ERROR, 400],
    [new DatabaseError('d'), ErrorCode.DATABASE_ERROR, 500],
    [new NotFoundError('thing', '42'), ErrorCode.NOT_FOUND, 404],
    [new NetworkError('n'), ErrorCode.NETWORK_ERROR, 503],
  ])('maps %p to the right code and status', (err, code, status) => {
    expect(err.code).toBe(code)
    expect(err.statusCode).toBe(status)
  })

  it('isAppError narrows correctly', () => {
    expect(isAppError(new ValidationError('v'))).toBe(true)
    expect(isAppError(new Error('plain'))).toBe(false)
  })

  it('handleError wraps unknown errors as INTERNAL_ERROR', () => {
    const wrapped = handleError('boom')
    expect(wrapped).toBeInstanceOf(AppError)
    expect(wrapped.code).toBe(ErrorCode.INTERNAL_ERROR)
    expect(wrapped.statusCode).toBe(500)
  })
})
