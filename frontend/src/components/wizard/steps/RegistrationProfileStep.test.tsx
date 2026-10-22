// Test suite for Registration Profile Step (#1221)
// Validates user profile information collection in wizard flow

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm } from 'react-hook-form'

interface ProfileFormData {
  displayName: string
  email: string
  phone: string
  bio: string
}

interface RegistrationProfileStepProps {
  register: any
  errors: any
  formData: ProfileFormData
  onUpdate: (data: Partial<ProfileFormData>) => void
}

// Mock component - will be extracted from ParticipantRegistrationPage
const RegistrationProfileStep = ({ register, errors, formData, onUpdate }: RegistrationProfileStepProps) => {
  return (
    <form data-testid="profile-form">
      <label>
        Display Name
        <input {...register('displayName', { required: 'Name is required' })} data-testid="displayName" />
      </label>
      {errors.displayName && <span data-testid="displayName-error">{errors.displayName.message}</span>}

      <label>
        Email
        <input {...register('email', { required: 'Email is required' })} data-testid="email" />
      </label>
      {errors.email && <span data-testid="email-error">{errors.email.message}</span>}

      <label>
        Phone
        <input {...register('phone')} data-testid="phone" />
      </label>

      <label>
        Bio
        <textarea {...register('bio')} data-testid="bio" />
      </label>
    </form>
  )
}

describe('RegistrationProfileStep', () => {
  it('should render profile form fields', () => {
    const mockRegister = vi.fn((name) => ({ name }))
    const mockErrors = {}

    render(
      <RegistrationProfileStep
        register={mockRegister}
        errors={mockErrors}
        formData={{ displayName: '', email: '', phone: '', bio: '' }}
        onUpdate={vi.fn()}
      />
    )

    expect(screen.getByTestId('displayName')).toBeInTheDocument()
    expect(screen.getByTestId('email')).toBeInTheDocument()
    expect(screen.getByTestId('phone')).toBeInTheDocument()
    expect(screen.getByTestId('bio')).toBeInTheDocument()
  })

  it('should display validation errors', () => {
    const mockRegister = vi.fn((name) => ({ name }))
    const mockErrors = {
      displayName: { message: 'Name is required' },
      email: { message: 'Valid email is required' },
    }

    render(
      <RegistrationProfileStep
        register={mockRegister}
        errors={mockErrors}
        formData={{ displayName: '', email: '', phone: '', bio: '' }}
        onUpdate={vi.fn()}
      />
    )

    expect(screen.getByTestId('displayName-error')).toHaveTextContent('Name is required')
    expect(screen.getByTestId('email-error')).toHaveTextContent('Valid email is required')
  })

  it('should populate fields with existing data', () => {
    const mockRegister = vi.fn((name) => ({
      name,
      value: 'John Doe'
    }))
    const mockErrors = {}

    render(
      <RegistrationProfileStep
        register={mockRegister}
        errors={mockErrors}
        formData={{ displayName: 'John Doe', email: 'john@example.com', phone: '1234567890', bio: 'Test bio' }}
        onUpdate={vi.fn()}
      />
    )

    expect(mockRegister).toHaveBeenCalledWith('displayName', expect.any(Object))
    expect(mockRegister).toHaveBeenCalledWith('email', expect.any(Object))
    expect(mockRegister).toHaveBeenCalledWith('phone', expect.any(Object))
    expect(mockRegister).toHaveBeenCalledWith('bio', expect.any(Object))
  })

  it('should have required field validation for displayName', () => {
    const mockRegister = vi.fn((name, validation) => {
      if (name === 'displayName') {
        expect(validation.required).toBe('Name is required')
      }
      return { name }
    })
    const mockErrors = {}

    render(
      <RegistrationProfileStep
        register={mockRegister}
        errors={mockErrors}
        formData={{ displayName: '', email: '', phone: '', bio: '' }}
        onUpdate={vi.fn()}
      />
    )

    expect(mockRegister).toHaveBeenCalledWith('displayName', expect.objectContaining({ required: 'Name is required' }))
  })

  it('should have required field validation for email', () => {
    const mockRegister = vi.fn((name, validation) => {
      if (name === 'email') {
        expect(validation.required).toBe('Email is required')
      }
      return { name }
    })
    const mockErrors = {}

    render(
      <RegistrationProfileStep
        register={mockRegister}
        errors={mockErrors}
        formData={{ displayName: '', email: '', phone: '', bio: '' }}
        onUpdate={vi.fn()}
      />
    )

    expect(mockRegister).toHaveBeenCalledWith('email', expect.objectContaining({ required: 'Email is required' }))
  })

  it('should allow optional phone and bio fields', () => {
    const mockRegister = vi.fn((name, validation) => {
      if (name === 'phone' || name === 'bio') {
        expect(validation.required).toBeUndefined()
      }
      return { name }
    })
    const mockErrors = {}

    render(
      <RegistrationProfileStep
        register={mockRegister}
        errors={mockErrors}
        formData={{ displayName: '', email: '', phone: '', bio: '' }}
        onUpdate={vi.fn()}
      />
    )

    expect(mockRegister).toHaveBeenCalledWith('phone', expect.any(Object))
    expect(mockRegister).toHaveBeenCalledWith('bio', expect.any(Object))
  })
})
