import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useImageUpload, MAX_IMAGES, MAX_SIZE_MB } from '../useImageUpload'

// Stub compression and IPFS so tests are fast and offline
vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}))

vi.mock('@/lib/ipfs', () => ({
  uploadToIPFS: vi.fn(async (_file: File, onProgress?: (n: number) => void) => {
    onProgress?.(100)
    return 'bafytestcid123'
  }),
  ipfsGatewayUrl: (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
}))

// URL.createObjectURL not available in jsdom
global.URL.createObjectURL = vi.fn(() => 'blob:mock')
global.URL.revokeObjectURL = vi.fn()

function makeFile(name: string, type = 'image/jpeg', sizeMB = 0.1): File {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024)
  return new File([bytes], name, { type })
}

describe('useImageUpload', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts with empty state', () => {
    const { result } = renderHook(() => useImageUpload())
    expect(result.current.images).toHaveLength(0)
    expect(result.current.cids).toHaveLength(0)
    expect(result.current.isUploading).toBe(false)
    expect(result.current.validationError).toBeNull()
  })

  it('adds and uploads a valid image', async () => {
    const { result } = renderHook(() => useImageUpload())
    await act(async () => {
      await result.current.addImages([makeFile('photo.jpg')])
    })
    expect(result.current.images).toHaveLength(1)
    expect(result.current.cids).toEqual(['bafytestcid123'])
  })

  it('rejects unsupported file type', async () => {
    const { result } = renderHook(() => useImageUpload())
    await act(async () => {
      await result.current.addImages([makeFile('doc.pdf', 'application/pdf')])
    })
    expect(result.current.images).toHaveLength(0)
    expect(result.current.validationError).toMatch(/unsupported format/)
  })

  it(`rejects files over ${MAX_SIZE_MB} MB`, async () => {
    const { result } = renderHook(() => useImageUpload())
    await act(async () => {
      await result.current.addImages([makeFile('big.jpg', 'image/jpeg', MAX_SIZE_MB + 1)])
    })
    expect(result.current.images).toHaveLength(0)
    expect(result.current.validationError).toMatch(/exceeds/)
  })

  it(`caps at ${MAX_IMAGES} images`, async () => {
    const { result } = renderHook(() => useImageUpload())
    const files = Array.from({ length: MAX_IMAGES + 2 }, (_, i) => makeFile(`img${i}.jpg`))
    await act(async () => {
      await result.current.addImages(files)
    })
    expect(result.current.images.length).toBeLessThanOrEqual(MAX_IMAGES)
  })

  it('removes an image by id', async () => {
    const { result } = renderHook(() => useImageUpload())
    await act(async () => {
      await result.current.addImages([makeFile('a.jpg')])
    })
    const id = result.current.images[0].id
    act(() => result.current.removeImage(id))
    expect(result.current.images).toHaveLength(0)
  })

  it('sets error state when upload fails', async () => {
    const { uploadToIPFS } = await import('@/lib/ipfs')
    vi.mocked(uploadToIPFS).mockRejectedValueOnce(new Error('A network error occurred during upload.'))

    const { result } = renderHook(() => useImageUpload())
    await act(async () => {
      await result.current.addImages([makeFile('fail.jpg')])
    })
    expect(result.current.images[0].error).toBe('Network error')
  })
})
