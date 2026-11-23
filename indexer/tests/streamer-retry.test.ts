import { withTimeoutAndRetry } from '../src/stellar/streamer'

describe('withTimeoutAndRetry (#1708)', () => {
  it('returns the result after transient failures', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue('ok')
    await expect(withTimeoutAndRetry(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('gives up after the last attempt', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('down'))
    await expect(withTimeoutAndRetry(fn)).rejects.toThrow('down')
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
