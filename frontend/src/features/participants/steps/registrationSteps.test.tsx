import { fireEvent,render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Role } from '@/api/types'

import { emptyDraft } from '../constants'
import { ConfirmStep } from './ConfirmStep'
import { ProfileStep } from './ProfileStep'
import { RoleStep } from './RoleStep'

describe('RoleStep', () => {
  it('reports the chosen role and shows the validation error', () => {
    const onSelect = vi.fn()
    render(
      <RoleStep selectedRole={null} onSelect={onSelect} error="Please select a role to continue." />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select Collector role' }))
    expect(onSelect).toHaveBeenCalledWith(Role.Collector)
    expect(screen.getByRole('alert')).toHaveTextContent('Please select a role to continue.')
  })

  it('marks the selected role as pressed', () => {
    render(<RoleStep selectedRole={Role.Manufacturer} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Select Manufacturer role' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})

describe('ProfileStep', () => {
  it('forwards field edits through onChange', () => {
    const onChange = vi.fn()
    render(<ProfileStep draft={{ ...emptyDraft }} errors={{}} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Ada' } })
    expect(onChange).toHaveBeenCalledWith('displayName', 'Ada')
  })

  it('shows the display name error and links it to the field', () => {
    render(
      <ProfileStep
        draft={{ ...emptyDraft }}
        errors={{ displayName: 'Display name is required.' }}
        onChange={vi.fn()}
      />
    )
    const input = screen.getByLabelText(/Display Name/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Display name is required.')
  })

  it('counts remaining bio characters', () => {
    render(
      <ProfileStep draft={{ ...emptyDraft, bio: 'abcd' }} errors={{}} onChange={vi.fn()} />
    )
    expect(screen.getByText(/196 chars remaining/)).toBeInTheDocument()
  })
})

describe('ConfirmStep', () => {
  const baseProps = {
    address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX',
    errors: {},
    summaryItems: [{ label: 'Role', value: 'Recycler' }],
    geo: { loading: false, error: null, onDetect: vi.fn() },
    onChange: vi.fn(),
  }

  it('toggles terms agreement through onChange', () => {
    const onChange = vi.fn()
    render(<ConfirmStep {...baseProps} draft={{ ...emptyDraft }} onChange={onChange} />)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith('agreedToTerms', true)
  })

  it('triggers location detection and shows the terms error', () => {
    const onDetect = vi.fn()
    render(
      <ConfirmStep
        {...baseProps}
        draft={{ ...emptyDraft }}
        errors={{ agreedToTerms: 'You must agree to the terms and conditions.' }}
        geo={{ loading: false, error: null, onDetect }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Detect My Location/ }))
    expect(onDetect).toHaveBeenCalledTimes(1)
    expect(screen.getByText('You must agree to the terms and conditions.')).toBeInTheDocument()
  })

  it('shows a submission error when provided', () => {
    render(
      <ConfirmStep
        {...baseProps}
        draft={{ ...emptyDraft, latitude: '1', longitude: '2' }}
        submitError="Registration failed. Please try again."
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Registration failed. Please try again.')
    expect(screen.getByText('1, 2')).toBeInTheDocument()
  })
})
