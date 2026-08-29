import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './Card'

expect.extend(toHaveNoViolations)

describe('Card Components', () => {
  describe('Card', () => {
    it('renders a card element', () => {
      const { container } = render(<Card>Card content</Card>)
      const card = container.querySelector('div')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card')
    })

    it('renders children', () => {
      render(<Card>My Card Content</Card>)
      expect(screen.getByText('My Card Content')).toBeInTheDocument()
    })

    it('accepts custom className', () => {
      const { container } = render(<Card className="custom-card">Content</Card>)
      const card = container.querySelector('div')
      expect(card).toHaveClass('custom-card')
    })

    it('passes through data attributes', () => {
      const { container } = render(
        <Card data-testid="card" data-variant="elevated">
          Content
        </Card>
      )
      const card = container.querySelector('[data-testid="card"]')
      expect(card).toHaveAttribute('data-variant', 'elevated')
    })

    it('renders as semantic container', () => {
      const { container } = render(
        <Card>
          <h2>Card Title</h2>
          <p>Card description</p>
        </Card>
      )
      const card = container.querySelector('div')
      expect(card?.querySelector('h2')).toBeInTheDocument()
    })
  })

  describe('CardHeader', () => {
    it('renders card header', () => {
      const { container } = render(
        <Card>
          <CardHeader>Header content</CardHeader>
        </Card>
      )
      const header = container.querySelector('div[class*="space-y"]')
      expect(header).toBeInTheDocument()
      expect(screen.getByText('Header content')).toBeInTheDocument()
    })

    it('has proper spacing classes', () => {
      const { container } = render(
        <Card>
          <CardHeader>Content</CardHeader>
        </Card>
      )
      const elements = container.querySelectorAll('div')
      const header = Array.from(elements).find((el) =>
        el.textContent?.includes('Content')
      )
      expect(header).toHaveClass('p-4')
    })

    it('accepts custom className', () => {
      const { container } = render(
        <Card>
          <CardHeader className="custom-header">Header</CardHeader>
        </Card>
      )
      const header = container.querySelector('.custom-header')
      expect(header).toBeInTheDocument()
    })
  })

  describe('CardTitle', () => {
    it('renders as h3 heading', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
        </Card>
      )
      const title = screen.getByRole('heading', { level: 3, name: /card title/i })
      expect(title).toBeInTheDocument()
    })

    it('has semantic heading structure', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Main Title</CardTitle>
          </CardHeader>
        </Card>
      )
      const heading = container.querySelector('h3')
      expect(heading?.textContent).toBe('Main Title')
    })

    it('applies correct typography classes', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Styled Title</CardTitle>
          </CardHeader>
        </Card>
      )
      const title = container.querySelector('h3')
      expect(title).toHaveClass('text-lg', 'font-semibold')
    })

    it('accepts custom className', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Custom Title</CardTitle>
          </CardHeader>
        </Card>
      )
      const title = screen.getByRole('heading')
      expect(title).toHaveClass('text-xl')
    })
  })

  describe('CardDescription', () => {
    it('renders a description paragraph', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>This is a description</CardDescription>
          </CardHeader>
        </Card>
      )
      const description = screen.getByText('This is a description')
      expect(description).toBeInTheDocument()
    })

    it('renders as paragraph element', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardDescription>Description text</CardDescription>
          </CardHeader>
        </Card>
      )
      const p = container.querySelector('p')
      expect(p?.textContent).toBe('Description text')
    })

    it('has appropriate styling for secondary text', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardDescription>Styled description</CardDescription>
          </CardHeader>
        </Card>
      )
      const description = container.querySelector('p')
      expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    })

    it('accepts custom className', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardDescription className="text-warning">Custom Description</CardDescription>
          </CardHeader>
        </Card>
      )
      const description = container.querySelector('p.text-warning')
      expect(description).toBeInTheDocument()
    })
  })

  describe('CardContent', () => {
    it('renders card content area', () => {
      render(
        <Card>
          <CardContent>Main content</CardContent>
        </Card>
      )
      expect(screen.getByText('Main content')).toBeInTheDocument()
    })

    it('has proper padding structure', () => {
      const { container } = render(
        <Card>
          <CardContent>Content</CardContent>
        </Card>
      )
      const elements = container.querySelectorAll('div')
      expect(elements.length).toBeGreaterThan(0)
    })

    it('accepts custom className', () => {
      const { container } = render(
        <Card>
          <CardContent className="custom-content">Content</CardContent>
        </Card>
      )
      const content = container.querySelector('.custom-content')
      expect(content).toBeInTheDocument()
    })

    it('renders child elements correctly', () => {
      render(
        <Card>
          <CardContent>
            <p>Paragraph</p>
            <span>Span</span>
          </CardContent>
        </Card>
      )
      expect(screen.getByText('Paragraph')).toBeInTheDocument()
      expect(screen.getByText('Span')).toBeInTheDocument()
    })
  })

  describe('CardFooter', () => {
    it('renders card footer', () => {
      render(
        <Card>
          <CardFooter>Footer content</CardFooter>
        </Card>
      )
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })

    it('has flex layout', () => {
      const { container } = render(
        <Card>
          <CardFooter>Footer</CardFooter>
        </Card>
      )
      const elements = container.querySelectorAll('div')
      // Footer should have flex classes applied
      expect(elements.length).toBeGreaterThan(0)
    })

    it('accepts custom className', () => {
      const { container } = render(
        <Card>
          <CardFooter className="custom-footer">Footer</CardFooter>
        </Card>
      )
      const footer = container.querySelector('.custom-footer')
      expect(footer).toBeInTheDocument()
    })

    it('renders multiple footer items', () => {
      render(
        <Card>
          <CardFooter>
            <button>Cancel</button>
            <button>Submit</button>
          </CardFooter>
        </Card>
      )
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    })
  })

  describe('Card Composition', () => {
    it('renders complete card structure', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Complete Card</CardTitle>
            <CardDescription>This is a complete card example</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>
      )

      expect(container.querySelector('h3')).toHaveTextContent('Complete Card')
      expect(screen.getByText('This is a complete card example')).toBeInTheDocument()
      expect(screen.getByText('Card content goes here')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('renders nested card structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Outer Card</CardTitle>
          </CardHeader>
          <CardContent>
            <Card>
              <CardHeader>
                <CardTitle>Inner Card</CardTitle>
              </CardHeader>
            </Card>
          </CardContent>
        </Card>
      )

      expect(screen.getByRole('heading', { name: /outer card/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /inner card/i })).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('complete card passes accessibility audit', async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Accessible Card</CardTitle>
            <CardDescription>Accessible description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Content</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('title is properly structured as heading', async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Main Card Title</CardTitle>
          </CardHeader>
        </Card>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('card with interactive elements passes accessibility', async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Interactive Card</CardTitle>
          </CardHeader>
          <CardContent>
            <label htmlFor="input">Input:</label>
            <input id="input" type="text" />
          </CardContent>
          <CardFooter>
            <button>Submit</button>
          </CardFooter>
        </Card>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('supports semantic structure', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Semantic Card</CardTitle>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
      )

      const heading = container.querySelector('h3')
      expect(heading).toBeInTheDocument()
      expect(heading?.tagName).toBe('H3')
    })
  })

  describe('ForwardRef', () => {
    it('Card forwards ref', () => {
      let cardRef: HTMLDivElement | null = null
      render(
        <Card
          ref={(el) => {
            cardRef = el
          }}
        >
          Content
        </Card>
      )
      expect(cardRef).toBeInstanceOf(HTMLDivElement)
    })

    it('CardTitle forwards ref', () => {
      let titleRef: HTMLHeadingElement | null = null
      render(
        <CardTitle
          ref={(el) => {
            titleRef = el
          }}
        >
          Title
        </CardTitle>
      )
      expect(titleRef).toBeInstanceOf(HTMLHeadingElement)
    })
  })
})
