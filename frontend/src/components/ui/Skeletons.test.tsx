import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  StatCardSkeleton,
  WasteCardSkeleton,
  IncentiveCardSkeleton,
  PageSkeleton,
} from './Skeletons'

describe('StatCardSkeleton', () => {
  it('renders a skeleton card with flex layout', () => {
    const { container } = render(<StatCardSkeleton />)
    const card = container.querySelector('.rounded-lg')
    expect(card).toBeInTheDocument()
    expect(card).toHaveClass('bg-card', 'border', 'shadow-sm', 'p-6', 'space-y-3')
  })

  it('renders two skeleton elements for stat card', () => {
    const { container } = render(<StatCardSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })

  it('contains label and value placeholders', () => {
    const { container } = render(<StatCardSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    // Should have at least label and value elements
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })

  it('applies animate-pulse class', () => {
    const { container } = render(<StatCardSkeleton />)
    const animated = container.querySelector('.animate-pulse')
    expect(animated).toHaveClass('animate-pulse')
  })
})

describe('WasteCardSkeleton', () => {
  it('renders a table row skeleton', () => {
    const { container } = render(
      <table>
        <tbody>
          <WasteCardSkeleton />
        </tbody>
      </table>
    )
    const row = container.querySelector('tr')
    expect(row).toBeInTheDocument()
  })

  it('renders six table cells for waste data', () => {
    const { container } = render(
      <table>
        <tbody>
          <WasteCardSkeleton />
        </tbody>
      </table>
    )
    const cells = container.querySelectorAll('td')
    expect(cells.length).toBe(6)
  })

  it('contains animated skeleton elements', () => {
    const { container } = render(
      <table>
        <tbody>
          <WasteCardSkeleton />
        </tbody>
      </table>
    )
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(6)
  })

  it('includes rounded-full for status badge', () => {
    const { container } = render(
      <table>
        <tbody>
          <WasteCardSkeleton />
        </tbody>
      </table>
    )
    const badge = container.querySelector('.rounded-full')
    expect(badge).toBeInTheDocument()
  })
})

describe('IncentiveCardSkeleton', () => {
  it('renders a table row skeleton', () => {
    const { container } = render(
      <table>
        <tbody>
          <IncentiveCardSkeleton />
        </tbody>
      </table>
    )
    const row = container.querySelector('tr')
    expect(row).toBeInTheDocument()
  })

  it('renders four table cells for incentive data', () => {
    const { container } = render(
      <table>
        <tbody>
          <IncentiveCardSkeleton />
        </tbody>
      </table>
    )
    const cells = container.querySelectorAll('td')
    expect(cells.length).toBe(4)
  })

  it('contains animated skeleton elements', () => {
    const { container } = render(
      <table>
        <tbody>
          <IncentiveCardSkeleton />
        </tbody>
      </table>
    )
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(4)
  })

  it('includes rounded-full for status badge', () => {
    const { container } = render(
      <table>
        <tbody>
          <IncentiveCardSkeleton />
        </tbody>
      </table>
    )
    const badge = container.querySelector('.rounded-full')
    expect(badge).toBeInTheDocument()
  })
})

describe('PageSkeleton', () => {
  it('renders a full-page skeleton layout', () => {
    const { container } = render(<PageSkeleton />)
    const page = container.querySelector('.space-y-6')
    expect(page).toBeInTheDocument()
    expect(page).toHaveClass('p-6')
  })

  it('includes header skeleton', () => {
    const { container } = render(<PageSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    // Should have multiple skeleton elements
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders grid of three stat cards', () => {
    const { container } = render(<PageSkeleton />)
    const cards = container.querySelectorAll('.rounded-lg.border')
    expect(cards.length).toBe(3)
  })

  it('renders list of skeleton rows', () => {
    const { container } = render(<PageSkeleton />)
    const rows = container.querySelectorAll('.h-16')
    expect(rows.length).toBe(4)
  })

  it('applies responsive grid classes', () => {
    const { container } = render(<PageSkeleton />)
    const grid = container.querySelector('.grid')
    expect(grid).toHaveClass('grid-cols-1')
    expect(grid).toHaveClass('gap-4')
    expect(grid).toHaveClass('sm:grid-cols-3')
  })

  it('maintains layout structure', () => {
    const { container } = render(<PageSkeleton />)
    const main = container.querySelector('.space-y-6')
    expect(main).toHaveClass('animate-pulse')
  })
})

describe('Skeleton components accessibility', () => {
  it('StatCardSkeleton is not interactive', () => {
    const { container } = render(<StatCardSkeleton />)
    const card = container.querySelector('.rounded-lg')
    expect(card?.tagName).toBe('DIV')
    expect(card).not.toHaveAttribute('role', 'button')
  })

  it('WasteCardSkeleton renders as semantic table row', () => {
    const { container } = render(
      <table>
        <tbody>
          <WasteCardSkeleton />
        </tbody>
      </table>
    )
    const row = container.querySelector('tr')
    expect(row?.tagName).toBe('TR')
  })

  it('PageSkeleton maintains semantic structure', () => {
    const { container } = render(<PageSkeleton />)
    const main = container.querySelector('.space-y-6')
    expect(main?.tagName).toBe('DIV')
  })
})

describe('Skeleton components styling', () => {
  it('all skeletons use bg-muted for consistency', () => {
    const { container: card } = render(<StatCardSkeleton />)
    const { container: waste } = render(
      <table>
        <tbody>
          <WasteCardSkeleton />
        </tbody>
      </table>
    )
    const { container: page } = render(<PageSkeleton />)

    expect(card.querySelector('.bg-muted')).toBeInTheDocument()
    expect(waste.querySelector('.bg-muted')).toBeInTheDocument()
    expect(page.querySelector('.bg-muted')).toBeInTheDocument()
  })

  it('skeletons use rounded-md by default', () => {
    const { container } = render(<StatCardSkeleton />)
    const skeleton = container.querySelector('.rounded-md')
    expect(skeleton).toBeInTheDocument()
  })

  it('PageSkeleton cards use rounded-lg', () => {
    const { container } = render(<PageSkeleton />)
    const cards = container.querySelectorAll('.rounded-lg')
    expect(cards.length).toBeGreaterThan(0)
  })
})
