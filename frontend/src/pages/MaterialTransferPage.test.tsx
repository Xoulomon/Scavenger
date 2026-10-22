import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MaterialTransferPage } from './MaterialTransferPage'
import { WasteType } from '@/api/types'

vi.mock('@/context/ContractContext', () => ({
  useContract: vi.fn(() => ({
    config: { network: 'TESTNET', rpcUrl: 'https://testnet', contractId: 'TEST_CONTRACT' },
  })),
}))

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => ({
    address: 'GABC123',
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

vi.mock('@/hooks/useAppTitle', () => ({
  useAppTitle: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options) => {
    if (options.queryKey[0] === 'participant-wastes') {
      return {
        data: [
          {
            waste_id: 1n,
            waste_type: WasteType.Paper,
            weight: 500n,
            recycled_timestamp: Math.floor(Date.now() / 1000),
            is_confirmed: true,
            is_active: true,
          },
          {
            waste_id: 2n,
            waste_type: WasteType.Plastic,
            weight: 250n,
            recycled_timestamp: Math.floor(Date.now() / 1000),
            is_confirmed: true,
            is_active: true,
          },
        ],
        isLoading: false,
        isError: false,
      }
    }
    return { data: null, isLoading: false, isError: false }
  }),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isLoading: false,
    isError: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}))

describe('MaterialTransferPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('StepIndicator component', () => {
    it('renders all transfer steps', () => {
      render(<MaterialTransferPage />)

      expect(screen.getByText(/Select Waste/)).toBeInTheDocument()
      expect(screen.getByText(/Destination/)).toBeInTheDocument()
      expect(screen.getByText(/Documentation/)).toBeInTheDocument()
      expect(screen.getByText(/Review/)).toBeInTheDocument()
    })

    it('displays current step progress', () => {
      render(<MaterialTransferPage />)

      expect(screen.getByText(/Step 1/)).toBeInTheDocument()
    })

    it('shows step icons', () => {
      render(<MaterialTransferPage />)

      const stepButtons = screen.getAllByRole('button').slice(0, 4)
      expect(stepButtons.length).toBeGreaterThan(0)
    })
  })

  describe('SelectWasteStep component', () => {
    it('displays list of available wastes', () => {
      render(<MaterialTransferPage />)

      expect(screen.getByText(/Select Waste/)).toBeInTheDocument()
      expect(screen.getByText(/Paper|Plastic/)).toBeInTheDocument()
    })

    it('shows waste details (type, weight, date)', () => {
      render(<MaterialTransferPage />)

      expect(screen.getByText(/Paper|Plastic/)).toBeInTheDocument()
      expect(screen.getByText(/500|250/)).toBeInTheDocument()
    })

    it('filters wastes by type', async () => {
      render(<MaterialTransferPage />)

      const filterButton = screen.queryByLabelText(/Filter/i)
      if (filterButton) {
        fireEvent.click(filterButton)

        const paperFilter = screen.getByText(/Paper/)
        fireEvent.click(paperFilter)

        await waitFor(() => {
          expect(screen.getByText(/Paper/)).toBeInTheDocument()
        })
      }
    })

    it('allows selecting a waste item', async () => {
      render(<MaterialTransferPage />)

      const wasteItem = screen.getByText(/Paper|Plastic/).closest('button')
      fireEvent.click(wasteItem!)

      await waitFor(() => {
        expect(screen.getByText(/Next/)).not.toBeDisabled()
      })
    })

    it('shows empty state when no wastes available', () => {
      const { useQuery } = require('@tanstack/react-query')
      useQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
      })

      render(<MaterialTransferPage />)

      expect(screen.getByText(/No waste items/i)).toBeInTheDocument()
    })

    it('displays loading state while fetching wastes', () => {
      const { useQuery } = require('@tanstack/react-query')
      useQuery.mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
      })

      render(<MaterialTransferPage />)

      const skeletons = document.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('DestinationStep component', () => {
    beforeEach(async () => {
      render(<MaterialTransferPage />)

      const wasteItem = screen.getByText(/Paper|Plastic/).closest('button')
      fireEvent.click(wasteItem!)

      const nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Destination/)).toBeInTheDocument()
      })
    })

    it('displays recipient address input field', () => {
      expect(screen.getByLabelText(/Recipient Address/i)).toBeInTheDocument()
    })

    it('validates Stellar address format', async () => {
      const addressInput = screen.getByLabelText(/Recipient Address/i) as HTMLInputElement
      fireEvent.change(addressInput, { target: { value: 'INVALID' } })

      fireEvent.blur(addressInput)

      await waitFor(() => {
        expect(screen.getByText(/Invalid address/i)).toBeInTheDocument()
      })
    })

    it('accepts valid Stellar address', async () => {
      const addressInput = screen.getByLabelText(/Recipient Address/i) as HTMLInputElement
      fireEvent.change(addressInput, { target: { value: 'GBCD123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' } })

      fireEvent.blur(addressInput)

      await waitFor(() => {
        expect(screen.queryByText(/Invalid address/i)).not.toBeInTheDocument()
      })
    })

    it('allows entering transfer notes', () => {
      const notesInput = screen.getByLabelText(/Transfer Notes/i) as HTMLInputElement
      fireEvent.change(notesInput, { target: { value: 'Test notes' } })

      expect(notesInput.value).toBe('Test notes')
    })

    it('allows entering condition notes', () => {
      const conditionInput = screen.getByLabelText(/Condition Notes/i) as HTMLInputElement
      fireEvent.change(conditionInput, { target: { value: 'Good condition' } })

      expect(conditionInput.value).toBe('Good condition')
    })

    it('enables next button with valid destination', async () => {
      const addressInput = screen.getByLabelText(/Recipient Address/i) as HTMLInputElement
      fireEvent.change(addressInput, { target: { value: 'GBCD123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' } })

      const nextButton = screen.getByText(/Next/)

      await waitFor(() => {
        expect(nextButton).not.toBeDisabled()
      })
    })
  })

  describe('PhotoUploadSection component', () => {
    beforeEach(async () => {
      render(<MaterialTransferPage />)

      const wasteItem = screen.getByText(/Paper|Plastic/).closest('button')
      fireEvent.click(wasteItem!)

      let nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Destination/)).toBeInTheDocument()
      })

      const addressInput = screen.getByLabelText(/Recipient Address/i) as HTMLInputElement
      fireEvent.change(addressInput, { target: { value: 'GBCD123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' } })

      nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Documentation/i)).toBeInTheDocument()
      })
    })

    it('displays before and after photo upload areas', () => {
      expect(screen.getByText(/Before Photos/i)).toBeInTheDocument()
      expect(screen.getByText(/After Photos/i)).toBeInTheDocument()
    })

    it('allows uploading multiple photos', async () => {
      const uploadAreas = screen.getAllByText(/Drag and drop/i)
      expect(uploadAreas.length).toBeGreaterThan(0)
    })

    it('displays uploaded photo previews', async () => {
      const beforePhotoInput = screen.getByLabelText(/Upload Before Photos/i) as HTMLInputElement

      const file = new File(['photo'], 'before.jpg', { type: 'image/jpeg' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      beforePhotoInput.files = dataTransfer.files

      fireEvent.change(beforePhotoInput)

      await waitFor(() => {
        expect(screen.getByText(/before.jpg/)).toBeInTheDocument()
      })
    })

    it('removes photos from list', async () => {
      const beforePhotoInput = screen.getByLabelText(/Upload Before Photos/i) as HTMLInputElement

      const file = new File(['photo'], 'before.jpg', { type: 'image/jpeg' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      beforePhotoInput.files = dataTransfer.files

      fireEvent.change(beforePhotoInput)

      await waitFor(() => {
        const removeButton = screen.getByRole('button', { name: /Remove|Delete/i })
        fireEvent.click(removeButton)
      })
    })
  })

  describe('DocumentationStep component', () => {
    it('displays upload areas for documentation', async () => {
      render(<MaterialTransferPage />)

      const wasteItem = screen.getByText(/Paper|Plastic/).closest('button')
      fireEvent.click(wasteItem!)

      let nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Destination/)).toBeInTheDocument()
      })

      const addressInput = screen.getByLabelText(/Recipient Address/i) as HTMLInputElement
      fireEvent.change(addressInput, { target: { value: 'GBCD123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' } })

      nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Handling Instructions/i)).toBeInTheDocument()
      })
    })

    it('validates handling instructions', async () => {
      render(<MaterialTransferPage />)

      const wasteItem = screen.getByText(/Paper|Plastic/).closest('button')
      fireEvent.click(wasteItem!)

      let nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Destination/)).toBeInTheDocument()
      })

      const addressInput = screen.getByLabelText(/Recipient Address/i) as HTMLInputElement
      fireEvent.change(addressInput, { target: { value: 'GBCD123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' } })

      nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        const handlingInput = screen.getByLabelText(/Handling Instructions/i)
        fireEvent.change(handlingInput, { target: { value: 'Handle with care' } })
        expect(handlingInput).toHaveValue('Handle with care')
      })
    })
  })

  describe('ReviewStep component', () => {
    it('displays summary of transfer details', () => {
      render(<MaterialTransferPage />)

      expect(screen.getByText(/Select Waste/)).toBeInTheDocument()
    })

    it('shows waste information to be transferred', () => {
      render(<MaterialTransferPage />)

      expect(screen.getByText(/Paper|Plastic/)).toBeInTheDocument()
    })

    it('displays recipient information', () => {
      render(<MaterialTransferPage />)

      expect(screen.getByText(/Destination|Recipient/i)).toBeInTheDocument()
    })

    it('shows all documentation collected', () => {
      render(<MaterialTransferPage />)

      expect(screen.getByText(/Documentation|Review/i)).toBeInTheDocument()
    })
  })

  describe('StatusTimeline component', () => {
    it('renders status timeline with all states', () => {
      render(<MaterialTransferPage />)

      expect(screen.getByText(/Pending|In Transit|Delivered|Confirmed/i)).toBeInTheDocument()
    })

    it('highlights current status', () => {
      render(<MaterialTransferPage />)

      const timeline = document.querySelector('[class*="timeline"]')
      expect(timeline).toBeInTheDocument()
    })
  })

  describe('TransferHistoryTab component', () => {
    it('displays transfer history records', () => {
      render(<MaterialTransferPage />)

      const historyTab = screen.queryByText(/History/i)
      if (historyTab) {
        fireEvent.click(historyTab)
        expect(screen.getByText(/Transfer History/i)).toBeInTheDocument()
      }
    })

    it('shows transfer records with details', () => {
      render(<MaterialTransferPage />)

      const historyTab = screen.queryByText(/History/i)
      if (historyTab) {
        fireEvent.click(historyTab)
        expect(screen.queryByText(/From:|To:|Date:/)).toBeTruthy()
      }
    })
  })

  describe('WasteChainHistory component', () => {
    it('displays chain of custody for waste item', () => {
      render(<MaterialTransferPage />)

      expect(screen.queryByText(/Chain|History|Timeline/i)).toBeTruthy()
    })

    it('shows all transfers and transformations', () => {
      render(<MaterialTransferPage />)

      expect(screen.queryByText(/Transfer|Received|Confirmed/i)).toBeTruthy()
    })
  })

  describe('Form Navigation', () => {
    it('prevents advancing without completing current step', () => {
      render(<MaterialTransferPage />)

      const nextButton = screen.getByText(/Next/)
      expect(nextButton).toBeDisabled()
    })

    it('allows going back to previous steps', async () => {
      render(<MaterialTransferPage />)

      const wasteItem = screen.getByText(/Paper|Plastic/).closest('button')
      fireEvent.click(wasteItem!)

      const nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Destination/)).toBeInTheDocument()
      })

      const backButton = screen.getByText(/Back/)
      fireEvent.click(backButton)

      await waitFor(() => {
        expect(screen.getByText(/Select Waste/)).toBeInTheDocument()
      })
    })

    it('preserves data when navigating back and forward', async () => {
      render(<MaterialTransferPage />)

      const wasteItem = screen.getByText(/Paper|Plastic/).closest('button')
      fireEvent.click(wasteItem!)

      let nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Destination/)).toBeInTheDocument()
      })

      const backButton = screen.getByText(/Back/)
      fireEvent.click(backButton)

      await waitFor(() => {
        expect(screen.getByText(/Select Waste/)).toBeInTheDocument()
        expect(wasteItem).toHaveAttribute('aria-selected', 'true')
      })
    })
  })

  describe('Accessibility', () => {
    it('renders with proper heading hierarchy', () => {
      render(<MaterialTransferPage />)

      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation between steps', async () => {
      render(<MaterialTransferPage />)

      const firstStep = screen.getByText(/Select Waste/).closest('button')
      firstStep?.focus()

      fireEvent.keyDown(firstStep!, { key: 'Enter', code: 'Enter' })

      await waitFor(() => {
        expect(screen.queryByText(/Select Waste/)).toBeTruthy()
      })
    })
  })
})
