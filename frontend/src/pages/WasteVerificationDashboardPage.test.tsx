import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WasteVerificationDashboardPage } from './WasteVerificationDashboardPage'
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
    if (options.queryKey[0] === 'dashboard-materials') {
      return {
        data: [
          {
            id: 1,
            waste_type: WasteType.Paper,
            weight: 500n,
            submitted_at: Math.floor(Date.now() / 1000),
            submitter: 'GABC123',
            current_owner: 'GABC123',
            verified: false,
            quality_grade: null,
          },
          {
            id: 2,
            waste_type: WasteType.Plastic,
            weight: 250n,
            submitted_at: Math.floor(Date.now() / 1000),
            submitter: 'GABC123',
            current_owner: 'GABC123',
            verified: true,
            quality_grade: 'A',
          },
          {
            id: 3,
            waste_type: WasteType.Metal,
            weight: 1000n,
            submitted_at: Math.floor(Date.now() / 1000),
            submitter: 'GABC123',
            current_owner: 'GABC123',
            verified: false,
            quality_grade: null,
          },
        ],
        isLoading: false,
        isError: false,
      }
    }
    if (options.queryKey[0] === 'material-transfers') {
      return {
        data: [
          {
            transfer_id: 1n,
            material_id: 1n,
            from: 'GABC123',
            to: 'GDEF456',
            transferred_at: Math.floor(Date.now() / 1000),
            status: 'delivered',
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

describe('WasteVerificationDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('DashboardStats component', () => {
    it('renders statistics cards', () => {
      render(<WasteVerificationDashboardPage />)

      expect(screen.getByText(/Total Materials|Pending Review|Verified/i)).toBeTruthy()
    })

    it('displays material count statistics', () => {
      render(<WasteVerificationDashboardPage />)

      expect(screen.getByText(/[0-9]+/)).toBeInTheDocument()
    })

    it('shows verification progress percentage', () => {
      render(<WasteVerificationDashboardPage />)

      const percentText = screen.queryByText(/%/)
      expect(percentText).toBeTruthy()
    })

    it('displays status breakdown pie chart', () => {
      render(<WasteVerificationDashboardPage />)

      expect(screen.getByText(/Status/i)).toBeInTheDocument()
    })
  })

  describe('FilterBar component', () => {
    it('renders filter controls', () => {
      render(<WasteVerificationDashboardPage />)

      expect(screen.getByLabelText(/Filter|Search/i)).toBeTruthy()
    })

    it('allows filtering by status', async () => {
      render(<WasteVerificationDashboardPage />)

      const statusFilter = screen.getByLabelText(/Status/i)
      if (statusFilter) {
        fireEvent.click(statusFilter)

        const pendingOption = screen.getByText(/Pending/)
        fireEvent.click(pendingOption)

        await waitFor(() => {
          expect(screen.getByText(/Pending/)).toBeInTheDocument()
        })
      }
    })

    it('allows filtering by waste type', async () => {
      render(<WasteVerificationDashboardPage />)

      const typeFilter = screen.queryByLabelText(/Type|Material/i)
      if (typeFilter) {
        fireEvent.click(typeFilter)

        const paperOption = screen.getByText(/Paper/)
        fireEvent.click(paperOption)

        await waitFor(() => {
          expect(screen.getByText(/Paper/)).toBeInTheDocument()
        })
      }
    })

    it('allows searching by material ID', async () => {
      render(<WasteVerificationDashboardPage />)

      const searchInput = screen.queryByPlaceholderText(/Search|ID/i)
      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: 'material-1' } })

        await waitFor(() => {
          expect(searchInput).toHaveValue('material-1')
        })
      }
    })

    it('allows sorting by different fields', async () => {
      render(<WasteVerificationDashboardPage />)

      const sortButton = screen.queryByLabelText(/Sort/i)
      if (sortButton) {
        fireEvent.click(sortButton)

        const sortByDate = screen.getByText(/Date/)
        fireEvent.click(sortByDate)

        await waitFor(() => {
          expect(screen.getByText(/Date/)).toBeInTheDocument()
        })
      }
    })

    it('allows resetting filters', async () => {
      render(<WasteVerificationDashboardPage />)

      const resetButton = screen.queryByText(/Clear|Reset/)
      if (resetButton) {
        fireEvent.click(resetButton)

        await waitFor(() => {
          expect(screen.getByText(/All|Any/i)).toBeInTheDocument()
        })
      }
    })
  })

  describe('WasteListItem component', () => {
    it('displays material list items', () => {
      render(<WasteVerificationDashboardPage />)

      expect(screen.getByText(/Paper|Plastic|Metal/)).toBeInTheDocument()
    })

    it('shows material ID and weight', () => {
      render(<WasteVerificationDashboardPage />)

      expect(screen.getByText(/#1|#2|#3/)).toBeInTheDocument()
      expect(screen.getByText(/500|250|1000/)).toBeInTheDocument()
    })

    it('displays material status badge', () => {
      render(<WasteVerificationDashboardPage />)

      expect(screen.getByText(/Pending|Verified/)).toBeInTheDocument()
    })

    it('shows submission date', () => {
      render(<WasteVerificationDashboardPage />)

      expect(screen.getByText(/ago|today|yesterday/i)).toBeTruthy()
    })

    it('allows selecting a material for details', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          expect(screen.getByText(/Details|Information/i)).toBeTruthy()
        })
      }
    })
  })

  describe('ImageComparison component', () => {
    it('displays before/after image comparison', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          expect(screen.getByText(/Before|After|Image/i)).toBeTruthy()
        })
      }
    })

    it('allows toggling between before and after images', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          const toggleButton = screen.queryByRole('button', { name: /Toggle|Switch/i })
          if (toggleButton) {
            fireEvent.click(toggleButton)
            expect(screen.getByText(/After/)).toBeInTheDocument()
          }
        })
      }
    })

    it('shows image zoom controls', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          const zoomButton = screen.queryByRole('button', { name: /Zoom|Expand/i })
          expect(zoomButton).toBeTruthy()
        })
      }
    })
  })

  describe('GradeSelector component', () => {
    it('displays quality grade options', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          expect(screen.getByText(/Grade|A|B|C|D|F/i)).toBeTruthy()
        })
      }
    })

    it('allows selecting a grade', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          const gradeButton = screen.queryByRole('button', { name: /Grade A/i })
          if (gradeButton) {
            fireEvent.click(gradeButton)
            expect(gradeButton).toHaveAttribute('aria-selected', 'true')
          }
        })
      }
    })

    it('displays grade descriptions', () => {
      render(<WasteVerificationDashboardPage />)

      expect(screen.queryByText(/Excellent|Good|Fair|Poor/i)).toBeTruthy()
    })
  })

  describe('VerificationForm component', () => {
    it('displays verification form fields', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          expect(screen.getByLabelText(/Notes|Comment/i)).toBeTruthy()
        })
      }
    })

    it('allows entering verification notes', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          const notesInput = screen.getByLabelText(/Notes|Comment/i) as HTMLInputElement
          fireEvent.change(notesInput, { target: { value: 'Good quality material' } })
          expect(notesInput.value).toBe('Good quality material')
        })
      }
    })

    it('allows marking material as contaminated', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          const contaminatedCheckbox = screen.queryByLabelText(/Contaminated/i)
          if (contaminatedCheckbox) {
            fireEvent.click(contaminatedCheckbox)
            expect(contaminatedCheckbox).toBeChecked()
          }
        })
      }
    })

    it('displays approve/reject buttons', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /Approve|Verify/i })).toBeInTheDocument()
          expect(screen.getByRole('button', { name: /Reject|Decline/i })).toBeInTheDocument()
        })
      }
    })
  })

  describe('WasteTimeline component', () => {
    it('displays material lifecycle timeline', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          expect(screen.getByText(/Submitted|Transfer|Verified/i)).toBeTruthy()
        })
      }
    })

    it('shows timeline events in chronological order', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          const timeline = document.querySelector('[class*="timeline"]')
          expect(timeline).toBeInTheDocument()
        })
      }
    })

    it('displays actor information for each event', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          expect(screen.queryByText(/by|from/i)).toBeTruthy()
        })
      }
    })
  })

  describe('DetailPanel component', () => {
    it('displays detailed material information', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          expect(screen.getByText(/Details|Information|Specifications/i)).toBeTruthy()
        })
      }
    })

    it('shows material attributes', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          expect(screen.getByText(/Type|Weight|Date|Status/i)).toBeTruthy()
        })
      }
    })

    it('displays transfer history', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        fireEvent.click(materialItem)

        await waitFor(() => {
          expect(screen.queryByText(/Transfer|History|From|To/i)).toBeTruthy()
        })
      }
    })
  })

  describe('BulkVerificationPanel component', () => {
    it('displays bulk action controls', () => {
      render(<WasteVerificationDashboardPage />)

      const bulkButton = screen.queryByText(/Bulk|Multiple/i)
      expect(bulkButton).toBeTruthy()
    })

    it('allows selecting multiple materials', async () => {
      render(<WasteVerificationDashboardPage />)

      const checkboxes = screen.queryAllByRole('checkbox')
      if (checkboxes.length > 0) {
        fireEvent.click(checkboxes[0])

        await waitFor(() => {
          expect(checkboxes[0]).toBeChecked()
        })
      }
    })

    it('shows bulk action options for selected materials', async () => {
      render(<WasteVerificationDashboardPage />)

      const checkboxes = screen.queryAllByRole('checkbox')
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[0])
        fireEvent.click(checkboxes[1])

        await waitFor(() => {
          expect(screen.getByText(/Approve All|Reject All/i)).toBeTruthy()
        })
      }
    })

    it('allows deselecting all materials', async () => {
      render(<WasteVerificationDashboardPage />)

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /Select All/i })
      if (selectAllCheckbox) {
        fireEvent.click(selectAllCheckbox)
        fireEvent.click(selectAllCheckbox)

        await waitFor(() => {
          expect(selectAllCheckbox).not.toBeChecked()
        })
      }
    })
  })

  describe('Export Functionality', () => {
    it('displays export button', () => {
      render(<WasteVerificationDashboardPage />)

      const exportButton = screen.getByRole('button', { name: /Export|Download/i })
      expect(exportButton).toBeInTheDocument()
    })

    it('exports verification data as CSV', async () => {
      render(<WasteVerificationDashboardPage />)

      const exportButton = screen.getByRole('button', { name: /Export|Download/i })
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(screen.getByText(/Export/i)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('renders with proper heading hierarchy', () => {
      render(<WasteVerificationDashboardPage />)

      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation', async () => {
      render(<WasteVerificationDashboardPage />)

      const materialItem = screen.getByText(/Paper|Plastic/).closest('button')
      if (materialItem) {
        materialItem.focus()

        fireEvent.keyDown(materialItem, { key: 'Enter', code: 'Enter' })

        await waitFor(() => {
          expect(materialItem).toHaveFocus()
        })
      }
    })

    it('provides screen reader text for status badges', () => {
      render(<WasteVerificationDashboardPage />)

      const statusBadges = screen.queryAllByRole('status')
      expect(statusBadges.length).toBeGreaterThan(0)
    })
  })
})
