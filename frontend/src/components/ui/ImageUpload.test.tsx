import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImageUpload } from './ImageUpload'
import type { ImageFile } from '@/hooks/useImageUpload'

vi.mock('@/lib/ipfs', () => ({
  ipfsGatewayUrl: (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
}))

const mockImage = (overrides: Partial<ImageFile> = {}): ImageFile => ({
  id: 'img-1',
  file: new File([''], 'photo.jpg', { type: 'image/jpeg' }),
  preview: 'blob:mock-preview',
  progress: 100,
  cid: 'bafytestcid',
  ...overrides,
})

describe('ImageUpload', () => {
  it('renders the dropzone when no images', () => {
    render(<ImageUpload images={[]} onAdd={vi.fn()} onRemove={vi.fn()} validationError={null} />)
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument()
  })

  it('shows validation error', () => {
    render(
      <ImageUpload images={[]} onAdd={vi.fn()} onRemove={vi.fn()} validationError="File too large" />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('File too large')
  })

  it('renders thumbnails for each image', () => {
    const images = [mockImage({ id: '1' }), mockImage({ id: '2', cid: undefined, progress: 50 })]
    render(<ImageUpload images={images} onAdd={vi.fn()} onRemove={vi.fn()} validationError={null} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn()
    render(<ImageUpload images={[mockImage()]} onAdd={vi.fn()} onRemove={onRemove} validationError={null} />)
    const btn = screen.getByRole('button', { name: /remove/i })
    fireEvent.click(btn)
    expect(onRemove).toHaveBeenCalledWith('img-1')
  })

  it('hides dropzone when at max images (5)', () => {
    const images = Array.from({ length: 5 }, (_, i) => mockImage({ id: String(i) }))
    render(<ImageUpload images={images} onAdd={vi.fn()} onRemove={vi.fn()} validationError={null} />)
    expect(screen.queryByText(/drag & drop/i)).not.toBeInTheDocument()
  })

  it('shows upload count summary', () => {
    render(<ImageUpload images={[mockImage()]} onAdd={vi.fn()} onRemove={vi.fn()} validationError={null} />)
    expect(screen.getByText(/1\/1 uploaded/i)).toBeInTheDocument()
  })
})
