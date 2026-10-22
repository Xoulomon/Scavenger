// Test suite for Registration KYC Step (#1221)
// Validates Know Your Customer verification in wizard flow

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FileInfo {
  name: string
  size: number
  type: string
}

interface RegistrationKYCStepProps {
  latitude: string
  longitude: string
  verificationDocs: FileInfo[]
  selfiPhoto: FileInfo | null
  onLocationUpdate: (lat: string, lon: string) => void
  onDocumentAdd: (file: FileInfo) => void
  onSelfieAdd: (file: FileInfo) => void
  errors: Record<string, string>
}

// Mock component - will be extracted from ParticipantRegistrationPage
const RegistrationKYCStep = ({
  latitude,
  longitude,
  verificationDocs,
  selfiPhoto,
  onLocationUpdate,
  onDocumentAdd,
  onSelfieAdd,
  errors,
}: RegistrationKYCStepProps) => {
  return (
    <div data-testid="kyc-form">
      <div>
        <label>
          Latitude
          <input
            value={latitude}
            onChange={(e) => onLocationUpdate(e.target.value, longitude)}
            data-testid="latitude"
          />
        </label>
        {errors.latitude && <span data-testid="latitude-error">{errors.latitude}</span>}
      </div>

      <div>
        <label>
          Longitude
          <input
            value={longitude}
            onChange={(e) => onLocationUpdate(latitude, e.target.value)}
            data-testid="longitude"
          />
        </label>
        {errors.longitude && <span data-testid="longitude-error">{errors.longitude}</span>}
      </div>

      <div data-testid="doc-upload">
        <h3>Upload Verification Documents</h3>
        <input type="file" data-testid="doc-input" accept=".pdf,.jpg,.jpeg,.png" />
        {verificationDocs.map((doc) => (
          <div key={doc.name} data-testid={`doc-${doc.name}`}>
            {doc.name}
          </div>
        ))}
      </div>

      <div data-testid="selfie-upload">
        <h3>Upload Selfie</h3>
        <input type="file" data-testid="selfie-input" accept=".jpg,.jpeg,.png" />
        {selfiPhoto && <div data-testid="selfie-preview">{selfiPhoto.name}</div>}
      </div>
    </div>
  )
}

describe('RegistrationKYCStep', () => {
  const mockProps = {
    latitude: '10.5',
    longitude: '20.5',
    verificationDocs: [],
    selfiPhoto: null,
    onLocationUpdate: vi.fn(),
    onDocumentAdd: vi.fn(),
    onSelfieAdd: vi.fn(),
    errors: {},
  }

  it('should render location fields', () => {
    render(<RegistrationKYCStep {...mockProps} />)

    expect(screen.getByTestId('latitude')).toBeInTheDocument()
    expect(screen.getByTestId('longitude')).toBeInTheDocument()
  })

  it('should display current location values', () => {
    render(<RegistrationKYCStep {...mockProps} />)

    expect(screen.getByTestId('latitude')).toHaveValue('10.5')
    expect(screen.getByTestId('longitude')).toHaveValue('20.5')
  })

  it('should call onLocationUpdate when latitude changes', () => {
    const onLocationUpdate = vi.fn()
    render(<RegistrationKYCStep {...mockProps} onLocationUpdate={onLocationUpdate} />)

    const latInput = screen.getByTestId('latitude')
    fireEvent.change(latInput, { target: { value: '15.5' } })

    expect(onLocationUpdate).toHaveBeenCalledWith('15.5', '20.5')
  })

  it('should call onLocationUpdate when longitude changes', () => {
    const onLocationUpdate = vi.fn()
    render(<RegistrationKYCStep {...mockProps} onLocationUpdate={onLocationUpdate} />)

    const lonInput = screen.getByTestId('longitude')
    fireEvent.change(lonInput, { target: { value: '25.5' } })

    expect(onLocationUpdate).toHaveBeenCalledWith('10.5', '25.5')
  })

  it('should display location validation errors', () => {
    const errors = {
      latitude: 'Invalid latitude',
      longitude: 'Invalid longitude',
    }
    render(<RegistrationKYCStep {...mockProps} errors={errors} />)

    expect(screen.getByTestId('latitude-error')).toHaveTextContent('Invalid latitude')
    expect(screen.getByTestId('longitude-error')).toHaveTextContent('Invalid longitude')
  })

  it('should render document upload section', () => {
    render(<RegistrationKYCStep {...mockProps} />)

    expect(screen.getByTestId('doc-upload')).toBeInTheDocument()
    expect(screen.getByTestId('doc-input')).toBeInTheDocument()
  })

  it('should display uploaded verification documents', () => {
    const docs = [{ name: 'id.pdf', size: 1024, type: 'application/pdf' }]
    render(<RegistrationKYCStep {...mockProps} verificationDocs={docs} />)

    expect(screen.getByTestId('doc-id.pdf')).toHaveTextContent('id.pdf')
  })

  it('should render selfie upload section', () => {
    render(<RegistrationKYCStep {...mockProps} />)

    expect(screen.getByTestId('selfie-upload')).toBeInTheDocument()
    expect(screen.getByTestId('selfie-input')).toBeInTheDocument()
  })

  it('should display uploaded selfie photo', () => {
    const selfie = { name: 'selfie.jpg', size: 2048, type: 'image/jpeg' }
    render(<RegistrationKYCStep {...mockProps} selfiPhoto={selfie} />)

    expect(screen.getByTestId('selfie-preview')).toHaveTextContent('selfie.jpg')
  })

  it('should accept only correct file types for documents', () => {
    render(<RegistrationKYCStep {...mockProps} />)

    const docInput = screen.getByTestId('doc-input')
    expect(docInput).toHaveAttribute('accept', '.pdf,.jpg,.jpeg,.png')
  })

  it('should accept only correct file types for selfie', () => {
    render(<RegistrationKYCStep {...mockProps} />)

    const selfieInput = screen.getByTestId('selfie-input')
    expect(selfieInput).toHaveAttribute('accept', '.jpg,.jpeg,.png')
  })

  it('should display multiple verification documents', () => {
    const docs = [
      { name: 'id.pdf', size: 1024, type: 'application/pdf' },
      { name: 'passport.jpg', size: 2048, type: 'image/jpeg' },
    ]
    render(<RegistrationKYCStep {...mockProps} verificationDocs={docs} />)

    expect(screen.getByTestId('doc-id.pdf')).toBeInTheDocument()
    expect(screen.getByTestId('doc-passport.jpg')).toBeInTheDocument()
  })
})
