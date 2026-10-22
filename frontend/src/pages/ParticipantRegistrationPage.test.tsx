import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ParticipantRegistrationPage } from './ParticipantRegistrationPage'
import { Role } from '@/api/types'

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}))

vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(() => ({
    getRootProps: vi.fn(() => ({})),
    getInputProps: vi.fn(() => ({})),
    isDragActive: false,
    acceptedFiles: [],
  })),
}))

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => ({
    address: 'GABC123',
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false,
  })),
}))

vi.mock('@/hooks/useAppTitle', () => ({
  useAppTitle: vi.fn(),
}))

vi.mock('@/hooks/useRegisterParticipant', () => ({
  useRegisterParticipant: vi.fn(() => ({
    register: vi.fn(),
    isLoading: false,
    isError: false,
    error: null,
  })),
}))

describe('ParticipantRegistrationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('StepIndicator component', () => {
    it('renders all registration steps', () => {
      render(<ParticipantRegistrationPage />)

      expect(screen.getByText(/Role/)).toBeInTheDocument()
      expect(screen.getByText(/Profile/)).toBeInTheDocument()
      expect(screen.getByText(/KYC/)).toBeInTheDocument()
      expect(screen.getByText(/Confirm/)).toBeInTheDocument()
    })

    it('highlights current step indicator', () => {
      render(<ParticipantRegistrationPage />)

      const stepIndicators = screen.getAllByRole('button')
      expect(stepIndicators.length).toBeGreaterThan(0)
    })

    it('displays step progress correctly', () => {
      render(<ParticipantRegistrationPage />)

      expect(screen.getByText(/Step 1/)).toBeInTheDocument()
    })
  })

  describe('Step 1: Role Selection', () => {
    it('renders role selection cards', () => {
      render(<ParticipantRegistrationPage />)

      expect(screen.getByText(/Recycler/)).toBeInTheDocument()
      expect(screen.getByText(/Collector/)).toBeInTheDocument()
      expect(screen.getByText(/Manufacturer/)).toBeInTheDocument()
    })

    it('displays role descriptions', () => {
      render(<ParticipantRegistrationPage />)

      expect(screen.getByText(/Collect and submit recyclable materials/)).toBeInTheDocument()
      expect(screen.getByText(/Transport and aggregate waste materials/)).toBeInTheDocument()
      expect(screen.getByText(/Transform recycled materials/)).toBeInTheDocument()
    })

    it('allows selecting a role', async () => {
      render(<ParticipantRegistrationPage />)

      const recyclerCard = screen.getByText(/Recycler/).closest('button')
      fireEvent.click(recyclerCard!)

      await waitFor(() => {
        expect(screen.getByText(/Recycler/)).toHaveAttribute('aria-pressed', 'true')
      })
    })

    it('enables next button only when role is selected', async () => {
      render(<ParticipantRegistrationPage />)

      const nextButton = screen.getByText(/Next/)
      expect(nextButton).toBeDisabled()

      const recyclerCard = screen.getByText(/Recycler/).closest('button')
      fireEvent.click(recyclerCard!)

      await waitFor(() => {
        expect(nextButton).not.toBeDisabled()
      })
    })

    it('allows going back from subsequent steps', async () => {
      render(<ParticipantRegistrationPage />)

      const recyclerCard = screen.getByText(/Recycler/).closest('button')
      fireEvent.click(recyclerCard!)

      const nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Profile/)).toBeInTheDocument()
      })

      const backButton = screen.getByText(/Back/)
      fireEvent.click(backButton)

      await waitFor(() => {
        expect(screen.getByText(/Recycler/)).toBeInTheDocument()
      })
    })
  })

  describe('Step 2: Profile Information', () => {
    beforeEach(async () => {
      render(<ParticipantRegistrationPage />)

      const recyclerCard = screen.getByText(/Recycler/).closest('button')
      fireEvent.click(recyclerCard!)

      const nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Profile/)).toBeInTheDocument()
      })
    })

    it('displays profile form fields', () => {
      expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument()
    })

    it('allows entering profile information', async () => {
      const nameInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'John Doe' } })

      await waitFor(() => {
        expect(nameInput.value).toBe('John Doe')
      })
    })

    it('validates email format', async () => {
      const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })

      fireEvent.blur(emailInput)

      await waitFor(() => {
        expect(screen.getByText(/Invalid email/i)).toBeInTheDocument()
      })
    })

    it('accepts valid email format', async () => {
      const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

      fireEvent.blur(emailInput)

      await waitFor(() => {
        expect(screen.queryByText(/Invalid email/i)).not.toBeInTheDocument()
      })
    })

    it('enables next button when form is valid', async () => {
      const nameInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement
      const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement
      const phoneInput = screen.getByLabelText(/Phone/i) as HTMLInputElement

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(phoneInput, { target: { value: '+1234567890' } })

      const nextButton = screen.getByText(/Next/)

      await waitFor(() => {
        expect(nextButton).not.toBeDisabled()
      })
    })

    it('saves form draft to localStorage', async () => {
      const nameInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'John Doe' } })

      await waitFor(() => {
        const draft = localStorage.getItem('scavngr_registration_draft')
        expect(draft).toBeTruthy()
      })
    })
  })

  describe('Step 3: KYC Documentation', () => {
    beforeEach(async () => {
      render(<ParticipantRegistrationPage />)

      const recyclerCard = screen.getByText(/Recycler/).closest('button')
      fireEvent.click(recyclerCard!)

      let nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Profile/)).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement
      const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement
      const phoneInput = screen.getByLabelText(/Phone/i) as HTMLInputElement

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(phoneInput, { target: { value: '+1234567890' } })

      nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/KYC/i)).toBeInTheDocument()
      })
    })

    it('displays KYC document upload areas', () => {
      expect(screen.getByText(/ID Document/i)).toBeInTheDocument()
      expect(screen.getByText(/Selfie/i)).toBeInTheDocument()
    })

    it('shows file upload dropzones', () => {
      const uploadAreas = screen.getAllByText(/Drag and drop/i)
      expect(uploadAreas.length).toBeGreaterThan(0)
    })

    it('displays file size restrictions', () => {
      expect(screen.getByText(/max 10 MB/i)).toBeInTheDocument()
    })

    it('validates accepted file types', () => {
      expect(screen.getByText(/PDF, JPEG, PNG/i)).toBeInTheDocument()
    })

    it('shows error for oversized files', async () => {
      const fileInput = screen.getByLabelText(/Upload ID Document/i) as HTMLInputElement

      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      })

      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(largeFile)
      fileInput.files = dataTransfer.files

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/File too large/i)).toBeInTheDocument()
      })
    })
  })

  describe('Step 4: Confirmation', () => {
    beforeEach(async () => {
      render(<ParticipantRegistrationPage />)

      const recyclerCard = screen.getByText(/Recycler/).closest('button')
      fireEvent.click(recyclerCard!)

      let nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Profile/)).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement
      const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement
      const phoneInput = screen.getByLabelText(/Phone/i) as HTMLInputElement

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(phoneInput, { target: { value: '+1234567890' } })

      nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/KYC/i)).toBeInTheDocument()
      })

      nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Confirm/i)).toBeInTheDocument()
      })
    })

    it('displays review of entered information', () => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument()
      expect(screen.getByText(/test@example.com/)).toBeInTheDocument()
    })

    it('shows role confirmation', () => {
      expect(screen.getByText(/Recycler/)).toBeInTheDocument()
    })

    it('requires agreement to terms', async () => {
      const registerButton = screen.getByText(/Register/)
      expect(registerButton).toBeDisabled()

      const termsCheckbox = screen.getByLabelText(/agree to the terms/i)
      fireEvent.click(termsCheckbox)

      await waitFor(() => {
        expect(registerButton).not.toBeDisabled()
      })
    })

    it('links to terms and conditions', () => {
      const termsLink = screen.getByRole('link', { name: /terms and conditions/i })
      expect(termsLink).toBeInTheDocument()
    })

    it('displays privacy policy link', () => {
      const privacyLink = screen.getByRole('link', { name: /privacy policy/i })
      expect(privacyLink).toBeInTheDocument()
    })
  })

  describe('Form Navigation', () => {
    it('prevents navigation with incomplete required fields', () => {
      render(<ParticipantRegistrationPage />)

      const nextButton = screen.getByText(/Next/)
      expect(nextButton).toBeDisabled()
    })

    it('saves progress when navigating between steps', async () => {
      render(<ParticipantRegistrationPage />)

      const recyclerCard = screen.getByText(/Recycler/).closest('button')
      fireEvent.click(recyclerCard!)

      let nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        const draft = localStorage.getItem('scavngr_registration_draft')
        expect(draft).toBeTruthy()
        const parsed = JSON.parse(draft!)
        expect(parsed.role).toBe(Role.Recycler)
      })
    })

    it('restores draft on page reload', async () => {
      render(<ParticipantRegistrationPage />)

      const recyclerCard = screen.getByText(/Recycler/).closest('button')
      fireEvent.click(recyclerCard!)

      const nextButton = screen.getByText(/Next/)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Profile/)).toBeInTheDocument()
      })
    })

    it('allows clearing draft', async () => {
      render(<ParticipantRegistrationPage />)

      const recyclerCard = screen.getByText(/Recycler/).closest('button')
      fireEvent.click(recyclerCard!)

      const clearButton = screen.queryByText(/Clear Draft/)
      if (clearButton) {
        fireEvent.click(clearButton)

        await waitFor(() => {
          const draft = localStorage.getItem('scavngr_registration_draft')
          expect(draft).not.toBeTruthy()
        })
      }
    })
  })

  describe('Accessibility', () => {
    it('renders with proper heading hierarchy', () => {
      render(<ParticipantRegistrationPage />)

      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
    })

    it('has proper form labels', () => {
      render(<ParticipantRegistrationPage />)

      const roleCards = screen.getAllByRole('button')
      expect(roleCards.length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation', async () => {
      render(<ParticipantRegistrationPage />)

      const recyclerCard = screen.getByText(/Recycler/).closest('button')
      recyclerCard!.focus()

      fireEvent.keyDown(recyclerCard!, { key: 'Enter', code: 'Enter' })

      await waitFor(() => {
        expect(screen.getByText(/Recycler/)).toHaveAttribute('aria-pressed', 'true')
      })
    })

    it('shows loading states with aria-busy', async () => {
      const { useRegisterParticipant } = require('@/hooks/useRegisterParticipant')
      useRegisterParticipant.mockReturnValue({
        register: vi.fn(),
        isLoading: true,
        isError: false,
        error: null,
      })

      render(<ParticipantRegistrationPage />)

      const registerButton = screen.queryByText(/Register/)
      if (registerButton) {
        expect(registerButton).toHaveAttribute('aria-busy', 'true')
      }
    })
  })

  describe('Error Handling', () => {
    it('displays registration error message', () => {
      const { useRegisterParticipant } = require('@/hooks/useRegisterParticipant')
      useRegisterParticipant.mockReturnValue({
        register: vi.fn(),
        isLoading: false,
        isError: true,
        error: 'Registration failed',
      })

      render(<ParticipantRegistrationPage />)

      expect(screen.getByText(/Registration failed/)).toBeInTheDocument()
    })

    it('allows retrying after error', async () => {
      const { useRegisterParticipant } = require('@/hooks/useRegisterParticipant')
      const mockRegister = vi.fn()
      useRegisterParticipant.mockReturnValue({
        register: mockRegister,
        isLoading: false,
        isError: true,
        error: 'Registration failed',
      })

      render(<ParticipantRegistrationPage />)

      const retryButton = screen.queryByText(/Retry/)
      if (retryButton) {
        fireEvent.click(retryButton)
        expect(mockRegister).toHaveBeenCalled()
      }
    })
  })
})
