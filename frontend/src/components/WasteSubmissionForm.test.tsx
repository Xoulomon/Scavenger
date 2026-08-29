import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WasteSubmissionForm } from '@/components/WasteSubmissionForm'

vi.mock('@/hooks/useImageUpload', () => ({
  useImageUpload: vi.fn(),
  MAX_IMAGES: 5,
  MAX_SIZE_MB: 5,
}))

interface MockImageUploadProps {
  images: File[]
  validationError: string | null
}

vi.mock('@/components/ui/ImageUpload', () => ({
  ImageUpload: ({ images, validationError }: MockImageUploadProps) => (
    <div data-testid="image-upload">
      <span data-testid="image-count">{images.length}</span>
      {validationError && <span data-testid="image-error">{validationError}</span>}
    </div>
  ),
}))

import { useImageUpload } from '@/hooks/useImageUpload'

const mockOnSubmit = vi.fn()
const mockOnCancel = vi.fn()

const defaultImageUpload = {
  images: [],
  addImages: vi.fn(),
  removeImage: vi.fn(),
  cids: [],
  isUploading: false,
  validationError: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useImageUpload).mockReturnValue(defaultImageUpload)
})

function renderForm() {
  return render(
    <WasteSubmissionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
  )
}

describe('WasteSubmissionForm', () => {
  it('renders all form sections', () => {
    renderForm()

    expect(screen.getByText('Material Type')).toBeInTheDocument()
    expect(screen.getByText('Photos')).toBeInTheDocument()
    expect(screen.getByText('Weight')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Submit Waste')).toBeInTheDocument()
    expect(screen.getByTestId('image-upload')).toBeInTheDocument()
  })

  it('shows validation errors on empty submit', async () => {
    renderForm()

    fireEvent.click(screen.getByText('Submit Waste'))

    await waitFor(() => {
      expect(screen.getByText('Material type is required')).toBeInTheDocument()
      expect(screen.getByText('Weight is required')).toBeInTheDocument()
      expect(screen.getByText('Latitude is required')).toBeInTheDocument()
      expect(screen.getByText('Longitude is required')).toBeInTheDocument()
      expect(screen.getByText('At least one photo is required')).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('weight unit conversion works', async () => {
    const user = userEvent.setup()
    renderForm()

    const weightInput = screen.getByLabelText('Weight *')
    await user.type(weightInput, '500')

    expect(screen.getByText('= 0.500 kg')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Switch to kilograms'))

    expect(screen.getByText('= 500000 g')).toBeInTheDocument()
  })

  it('material type search/filter works', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByLabelText('Select material type'))

    expect(screen.getByText('Paper')).toBeInTheDocument()
    expect(screen.getByText('Metal')).toBeInTheDocument()
    expect(screen.getByText('Glass')).toBeInTheDocument()
    expect(screen.getByText('Organic')).toBeInTheDocument()
    expect(screen.getByText('Electronic')).toBeInTheDocument()

    const searchInput = screen.getByLabelText('Search materials')
    await user.type(searchInput, 'pla')

    expect(screen.getByText('PET Plastic')).toBeInTheDocument()
    expect(screen.getByText('Plastic')).toBeInTheDocument()
    expect(screen.queryByText('Paper')).not.toBeInTheDocument()
    expect(screen.queryByText('Metal')).not.toBeInTheDocument()
  })

  it('form submits with valid data', async () => {
    const user = userEvent.setup()
    vi.mocked(useImageUpload).mockReturnValue({
      ...defaultImageUpload,
      images: [{ id: '1', file: new File([], 'test.jpg'), preview: '', progress: 100, cid: 'Qm123' }],
      cids: ['Qm123'],
    })
    mockOnSubmit.mockResolvedValue(undefined)

    renderForm()

    await user.click(screen.getByLabelText('Select material type'))
    await user.click(screen.getByText('Paper'))

    await user.type(screen.getByLabelText('Weight *'), '500')
    await user.type(screen.getByLabelText('Latitude'), '40.7128')
    await user.type(screen.getByLabelText('Longitude'), '-74.006')

    await user.click(screen.getByText('Submit Waste'))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        wasteType: 0,
        weight: 500,
        latitude: '40.7128',
        longitude: '-74.006',
        notes: '',
        photoCids: ['Qm123'],
      })
    })
  })

  it('cancel button calls onCancel', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByText('Cancel'))
    expect(mockOnCancel).toHaveBeenCalledOnce()
  })

  it('renders summary when submit succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(useImageUpload).mockReturnValue({
      ...defaultImageUpload,
      images: [{ id: '1', file: new File([], 'test.jpg'), preview: '', progress: 100, cid: 'Qm123' }],
      cids: ['Qm123'],
    })
    mockOnSubmit.mockResolvedValue(undefined)

    renderForm()

    await user.click(screen.getByLabelText('Select material type'))
    await user.click(screen.getByText('Paper'))
    await user.type(screen.getByLabelText('Weight *'), '500')
    await user.type(screen.getByLabelText('Latitude'), '40.7128')
    await user.type(screen.getByLabelText('Longitude'), '-74.006')
    await user.click(screen.getByText('Submit Waste'))

    await waitFor(() => {
      expect(screen.getByText('Waste Submitted Successfully')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Done'))
    expect(mockOnCancel).toHaveBeenCalled()
  })
})

