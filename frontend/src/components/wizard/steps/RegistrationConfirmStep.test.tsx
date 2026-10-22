// Test suite for Registration Confirmation Step (#1221)
// Validates final review and confirmation in wizard flow

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Role } from '@/api/types'

interface ConfirmationData {
  role: Role
  displayName: string
  email: string
  phone: string
  latitude: string
  longitude: string
  hasDocuments: boolean
  hasSelfie: boolean
  agreedToTerms: boolean
}

interface RegistrationConfirmStepProps {
  data: ConfirmationData
  isLoading: boolean
  onConfirm: () => void
  onPrevious: () => void
  onTermsChange: (agreed: boolean) => void
}

// Mock component - will be extracted from ParticipantRegistrationPage
const RegistrationConfirmStep = ({
  data,
  isLoading,
  onConfirm,
  onPrevious,
  onTermsChange,
}: RegistrationConfirmStepProps) => {
  return (
    <div data-testid="confirm-form">
      <h2>Review Your Registration</h2>

      <div data-testid="role-review">
        <p>Role: {Role[data.role]}</p>
      </div>

      <div data-testid="profile-review">
        <p>Name: {data.displayName}</p>
        <p>Email: {data.email}</p>
        <p>Phone: {data.phone || 'Not provided'}</p>
      </div>

      <div data-testid="location-review">
        <p>Latitude: {data.latitude}</p>
        <p>Longitude: {data.longitude}</p>
      </div>

      <div data-testid="documents-review">
        <p>Documents: {data.hasDocuments ? 'Uploaded' : 'Not provided'}</p>
        <p>Selfie: {data.hasSelfie ? 'Uploaded' : 'Not provided'}</p>
      </div>

      <div data-testid="terms-section">
        <label>
          <input
            type="checkbox"
            checked={data.agreedToTerms}
            onChange={(e) => onTermsChange(e.target.checked)}
            data-testid="terms-checkbox"
          />
          I agree to the Terms and Conditions
        </label>
      </div>

      <div data-testid="action-buttons">
        <button onClick={onPrevious} data-testid="previous-button" disabled={isLoading}>
          Previous
        </button>
        <button onClick={onConfirm} data-testid="confirm-button" disabled={!data.agreedToTerms || isLoading}>
          {isLoading ? 'Confirming...' : 'Confirm Registration'}
        </button>
      </div>
    </div>
  )
}

describe('RegistrationConfirmStep', () => {
  const mockData: ConfirmationData = {
    role: Role.Recycler,
    displayName: 'John Doe',
    email: 'john@example.com',
    phone: '1234567890',
    latitude: '10.5',
    longitude: '20.5',
    hasDocuments: true,
    hasSelfie: true,
    agreedToTerms: false,
  }

  const mockProps = {
    data: mockData,
    isLoading: false,
    onConfirm: vi.fn(),
    onPrevious: vi.fn(),
    onTermsChange: vi.fn(),
  }

  it('should display role information', () => {
    render(<RegistrationConfirmStep {...mockProps} />)

    expect(screen.getByTestId('role-review')).toBeInTheDocument()
    expect(screen.getByText(/Role:/)).toBeInTheDocument()
  })

  it('should display profile information', () => {
    render(<RegistrationConfirmStep {...mockProps} />)

    expect(screen.getByText(`Name: ${mockData.displayName}`)).toBeInTheDocument()
    expect(screen.getByText(`Email: ${mockData.email}`)).toBeInTheDocument()
    expect(screen.getByText(`Phone: ${mockData.phone}`)).toBeInTheDocument()
  })

  it('should handle missing phone number', () => {
    const data = { ...mockData, phone: '' }
    render(<RegistrationConfirmStep {...mockProps} data={data} />)

    expect(screen.getByText(/Phone: Not provided/)).toBeInTheDocument()
  })

  it('should display location information', () => {
    render(<RegistrationConfirmStep {...mockProps} />)

    expect(screen.getByText(`Latitude: ${mockData.latitude}`)).toBeInTheDocument()
    expect(screen.getByText(`Longitude: ${mockData.longitude}`)).toBeInTheDocument()
  })

  it('should display document upload status', () => {
    render(<RegistrationConfirmStep {...mockProps} />)

    expect(screen.getByText(/Documents: Uploaded/)).toBeInTheDocument()
    expect(screen.getByText(/Selfie: Uploaded/)).toBeInTheDocument()
  })

  it('should handle missing documents', () => {
    const data = { ...mockData, hasDocuments: false, hasSelfie: false }
    render(<RegistrationConfirmStep {...mockProps} data={data} />)

    expect(screen.getByText(/Documents: Not provided/)).toBeInTheDocument()
    expect(screen.getByText(/Selfie: Not provided/)).toBeInTheDocument()
  })

  it('should display terms checkbox', () => {
    render(<RegistrationConfirmStep {...mockProps} />)

    expect(screen.getByTestId('terms-checkbox')).toBeInTheDocument()
    expect(screen.getByText(/I agree to the Terms and Conditions/)).toBeInTheDocument()
  })

  it('should call onTermsChange when checkbox is toggled', () => {
    const onTermsChange = vi.fn()
    render(<RegistrationConfirmStep {...mockProps} onTermsChange={onTermsChange} />)

    const checkbox = screen.getByTestId('terms-checkbox')
    fireEvent.click(checkbox)

    expect(onTermsChange).toHaveBeenCalledWith(true)
  })

  it('should disable confirm button when terms not agreed', () => {
    const data = { ...mockData, agreedToTerms: false }
    render(<RegistrationConfirmStep {...mockProps} data={data} />)

    expect(screen.getByTestId('confirm-button')).toBeDisabled()
  })

  it('should enable confirm button when terms are agreed', () => {
    const data = { ...mockData, agreedToTerms: true }
    render(<RegistrationConfirmStep {...mockProps} data={data} />)

    expect(screen.getByTestId('confirm-button')).not.toBeDisabled()
  })

  it('should call onConfirm when confirm button is clicked', () => {
    const data = { ...mockData, agreedToTerms: true }
    const onConfirm = vi.fn()
    render(<RegistrationConfirmStep {...mockProps} data={data} onConfirm={onConfirm} />)

    const confirmButton = screen.getByTestId('confirm-button')
    fireEvent.click(confirmButton)

    expect(onConfirm).toHaveBeenCalled()
  })

  it('should call onPrevious when previous button is clicked', () => {
    const onPrevious = vi.fn()
    render(<RegistrationConfirmStep {...mockProps} onPrevious={onPrevious} />)

    const previousButton = screen.getByTestId('previous-button')
    fireEvent.click(previousButton)

    expect(onPrevious).toHaveBeenCalled()
  })

  it('should disable all buttons when loading', () => {
    const data = { ...mockData, agreedToTerms: true }
    render(<RegistrationConfirmStep {...mockProps} data={data} isLoading={true} />)

    expect(screen.getByTestId('previous-button')).toBeDisabled()
    expect(screen.getByTestId('confirm-button')).toBeDisabled()
  })

  it('should show loading state on confirm button', () => {
    const data = { ...mockData, agreedToTerms: true }
    render(<RegistrationConfirmStep {...mockProps} data={data} isLoading={true} />)

    expect(screen.getByText('Confirming...')).toBeInTheDocument()
  })

  it('should show normal button text when not loading', () => {
    const data = { ...mockData, agreedToTerms: true }
    render(<RegistrationConfirmStep {...mockProps} data={data} isLoading={false} />)

    expect(screen.getByText('Confirm Registration')).toBeInTheDocument()
  })
})
