import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CarbonImpactCard } from './index'

describe('CarbonImpactCard', () => {
  it('should render carbon impact title', () => {
    render(<CarbonImpactCard />)
    expect(screen.getByText('Carbon Credits Impact')).toBeInTheDocument()
  })

  it('should display total carbon credits', () => {
    render(<CarbonImpactCard />)
    expect(screen.getByText('2,450')).toBeInTheDocument()
  })

  it('should show monthly growth percentage', () => {
    render(<CarbonImpactCard />)
    expect(screen.getByText('+12.5%')).toBeInTheDocument()
  })

  it('should display trees equivalent', () => {
    render(<CarbonImpactCard />)
    expect(screen.getByText('112')).toBeInTheDocument()
    expect(screen.getByText('Trees Planted Equivalent')).toBeInTheDocument()
  })

  it('should show CO2 reduction', () => {
    render(<CarbonImpactCard />)
    expect(screen.getByText('3.2 tons')).toBeInTheDocument()
  })
})
