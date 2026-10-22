// Test suite for Registration Role Selection Step (#1221)
// Validates role selection in participant registration wizard flow

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Role } from '@/api/types'

interface RegistrationRoleStepProps {
  selectedRole: Role | null
  onRoleSelect: (role: Role) => void
}

// Mock component - will be extracted from ParticipantRegistrationPage
const RegistrationRoleStep = ({ selectedRole, onRoleSelect }: RegistrationRoleStepProps) => {
  const roles = [
    { role: Role.Recycler, title: 'Recycler', description: 'Collect and submit recyclable materials' },
    { role: Role.Collector, title: 'Collector', description: 'Transport and aggregate waste materials' },
    { role: Role.Manufacturer, title: 'Manufacturer', description: 'Transform recycled materials' },
  ]

  return (
    <div data-testid="role-selection">
      <h2>Select Your Role</h2>
      {roles.map((r) => (
        <button
          key={r.role}
          data-testid={`role-${r.role}`}
          onClick={() => onRoleSelect(r.role)}
          className={selectedRole === r.role ? 'selected' : ''}
        >
          <h3>{r.title}</h3>
          <p>{r.description}</p>
        </button>
      ))}
    </div>
  )
}

describe('RegistrationRoleStep', () => {
  it('should render all role options', () => {
    const onRoleSelect = vi.fn()
    render(<RegistrationRoleStep selectedRole={null} onRoleSelect={onRoleSelect} />)

    expect(screen.getByText('Recycler')).toBeInTheDocument()
    expect(screen.getByText('Collector')).toBeInTheDocument()
    expect(screen.getByText('Manufacturer')).toBeInTheDocument()
  })

  it('should display role descriptions', () => {
    const onRoleSelect = vi.fn()
    render(<RegistrationRoleStep selectedRole={null} onRoleSelect={onRoleSelect} />)

    expect(screen.getByText('Collect and submit recyclable materials')).toBeInTheDocument()
    expect(screen.getByText('Transport and aggregate waste materials')).toBeInTheDocument()
    expect(screen.getByText('Transform recycled materials')).toBeInTheDocument()
  })

  it('should call onRoleSelect when role is clicked', () => {
    const onRoleSelect = vi.fn()
    render(<RegistrationRoleStep selectedRole={null} onRoleSelect={onRoleSelect} />)

    const recyclerButton = screen.getByTestId('role-0')
    fireEvent.click(recyclerButton)

    expect(onRoleSelect).toHaveBeenCalledWith(Role.Recycler)
  })

  it('should highlight selected role', () => {
    const onRoleSelect = vi.fn()
    render(<RegistrationRoleStep selectedRole={Role.Recycler} onRoleSelect={onRoleSelect} />)

    const recyclerButton = screen.getByTestId('role-0')
    expect(recyclerButton).toHaveClass('selected')
  })

  it('should allow changing selected role', () => {
    const onRoleSelect = vi.fn()
    const { rerender } = render(<RegistrationRoleStep selectedRole={Role.Recycler} onRoleSelect={onRoleSelect} />)

    const collectorButton = screen.getByTestId('role-1')
    fireEvent.click(collectorButton)

    expect(onRoleSelect).toHaveBeenCalledWith(Role.Collector)

    rerender(<RegistrationRoleStep selectedRole={Role.Collector} onRoleSelect={onRoleSelect} />)
    expect(collectorButton).toHaveClass('selected')
  })
})
