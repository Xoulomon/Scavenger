import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { memo, useMemo, useState } from 'react'

// Test component - memoized list item
const MemoizedListItem = memo(({ item, onSelect }: { item: { id: string; name: string }; onSelect: (id: string) => void }) => {
  return (
    <li data-testid={`item-${item.id}`} onClick={() => onSelect(item.id)}>
      {item.name}
    </li>
  )
})

// Test component - list with memoization
const MemoizedList = ({ items, onSelect }: { items: Array<{ id: string; name: string }>; onSelect: (id: string) => void }) => {
  return (
    <ul>
      {items.map(item => (
        <MemoizedListItem key={item.id} item={item} onSelect={onSelect} />
      ))}
    </ul>
  )
}

describe('Memoized List Component', () => {
  const mockItems = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    { id: '3', name: 'Item 3' },
  ]

  it('renders all items', () => {
    const handleSelect = vi.fn()
    render(<MemoizedList items={mockItems} onSelect={handleSelect} />)

    mockItems.forEach(item => {
      expect(screen.getByTestId(`item-${item.id}`)).toBeInTheDocument()
    })
  })

  it('renders item names correctly', () => {
    const handleSelect = vi.fn()
    render(<MemoizedList items={mockItems} onSelect={handleSelect} />)

    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
    expect(screen.getByText('Item 3')).toBeInTheDocument()
  })

  it('calls onSelect handler when item is clicked', async () => {
    const handleSelect = vi.fn()
    const user = (await import('@testing-library/user-event')).default
    render(<MemoizedList items={mockItems} onSelect={handleSelect} />)

    const item = screen.getByTestId('item-1')
    await user.click(item)

    expect(handleSelect).toHaveBeenCalledWith('1')
  })

  it('renders empty list when items array is empty', () => {
    const handleSelect = vi.fn()
    const { container } = render(<MemoizedList items={[]} onSelect={handleSelect} />)

    const list = container.querySelector('ul')
    expect(list).toBeInTheDocument()
    expect(list?.children).toHaveLength(0)
  })

  it('adds new items to the list', () => {
    const handleSelect = vi.fn()
    const { rerender } = render(<MemoizedList items={mockItems} onSelect={handleSelect} />)

    const newItems = [
      ...mockItems,
      { id: '4', name: 'Item 4' },
      { id: '5', name: 'Item 5' },
    ]

    rerender(<MemoizedList items={newItems} onSelect={handleSelect} />)

    expect(screen.getByTestId('item-4')).toBeInTheDocument()
    expect(screen.getByTestId('item-5')).toBeInTheDocument()
  })

  it('removes items from the list', () => {
    const handleSelect = vi.fn()
    const { rerender } = render(<MemoizedList items={mockItems} onSelect={handleSelect} />)

    const reducedItems = [mockItems[0], mockItems[2]]
    rerender(<MemoizedList items={reducedItems} onSelect={handleSelect} />)

    expect(screen.getByTestId('item-1')).toBeInTheDocument()
    expect(screen.queryByTestId('item-2')).not.toBeInTheDocument()
    expect(screen.getByTestId('item-3')).toBeInTheDocument()
  })

  it('updates items in the list', () => {
    const handleSelect = vi.fn()
    const { rerender } = render(<MemoizedList items={mockItems} onSelect={handleSelect} />)

    const updatedItems = [
      { id: '1', name: 'Updated Item 1' },
      { id: '2', name: 'Item 2' },
      { id: '3', name: 'Item 3' },
    ]

    rerender(<MemoizedList items={updatedItems} onSelect={handleSelect} />)

    expect(screen.getByText('Updated Item 1')).toBeInTheDocument()
  })

  it('handles large lists efficiently', () => {
    const handleSelect = vi.fn()
    const largeList = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
    }))

    const { container } = render(<MemoizedList items={largeList} onSelect={handleSelect} />)

    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(1000)
  })

  it('preserves memoization across re-renders', () => {
    const handleSelect = vi.fn()
    const renderSpy = vi.fn()

    const SpyedMemoizedItem = memo(({ item }: { item: { id: string; name: string } }) => {
      renderSpy()
      return <li data-testid={`item-${item.id}`}>{item.name}</li>
    })

    const TestList = ({ items }: { items: Array<{ id: string; name: string }> }) => (
      <ul>
        {items.map(item => (
          <SpyedMemoizedItem key={item.id} item={item} />
        ))}
      </ul>
    )

    const { rerender } = render(<TestList items={mockItems} />)
    const initialRenderCount = renderSpy.mock.calls.length

    rerender(<TestList items={mockItems} />)
    const afterReRenderCount = renderSpy.mock.calls.length

    expect(afterReRenderCount).toBeLessThan(initialRenderCount + mockItems.length)
  })
})

describe('List with useMemo Optimization', () => {
  const TestListWithMemo = ({ items, filter }: { items: Array<{ id: string; name: string }>; filter: string }) => {
    const filteredItems = useMemo(() => {
      return items.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()))
    }, [items, filter])

    return (
      <ul>
        {filteredItems.map(item => (
          <li key={item.id} data-testid={`item-${item.id}`}>
            {item.name}
          </li>
        ))}
      </ul>
    )
  }

  it('filters items with memoization', () => {
    const items = [
      { id: '1', name: 'Apple' },
      { id: '2', name: 'Banana' },
      { id: '3', name: 'Apricot' },
    ]

    render(<TestListWithMemo items={items} filter="ap" />)

    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Apricot')).toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
  })

  it('recalculates filter when items change', () => {
    const initialItems = [{ id: '1', name: 'Test' }]
    const { rerender } = render(<TestListWithMemo items={initialItems} filter="test" />)

    expect(screen.getByText('Test')).toBeInTheDocument()

    const newItems = [{ id: '1', name: 'Test' }, { id: '2', name: 'Testing' }]
    rerender(<TestListWithMemo items={newItems} filter="test" />)

    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Testing')).toBeInTheDocument()
  })

  it('recalculates filter when filter text changes', () => {
    const items = [
      { id: '1', name: 'Cat' },
      { id: '2', name: 'Car' },
      { id: '3', name: 'Dog' },
    ]

    const { rerender } = render(<TestListWithMemo items={items} filter="ca" />)

    expect(screen.getByText('Cat')).toBeInTheDocument()
    expect(screen.getByText('Car')).toBeInTheDocument()
    expect(screen.queryByText('Dog')).not.toBeInTheDocument()

    rerender(<TestListWithMemo items={items} filter="do" />)

    expect(screen.queryByText('Cat')).not.toBeInTheDocument()
    expect(screen.queryByText('Car')).not.toBeInTheDocument()
    expect(screen.getByText('Dog')).toBeInTheDocument()
  })

  it('handles empty filter results', () => {
    const items = [{ id: '1', name: 'Item 1' }]
    const { container } = render(<TestListWithMemo items={items} filter="xyz" />)

    const list = container.querySelector('ul')
    expect(list?.children).toHaveLength(0)
  })

  it('clears filter to show all items', () => {
    const items = [
      { id: '1', name: 'Apple' },
      { id: '2', name: 'Banana' },
      { id: '3', name: 'Cherry' },
    ]

    const { rerender } = render(<TestListWithMemo items={items} filter="a" />)

    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()

    rerender(<TestListWithMemo items={items} filter="" />)

    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
    expect(screen.getByText('Cherry')).toBeInTheDocument()
  })
})

describe('VirtualizedList - Performance', () => {
  const TestVirtualizedList = ({ items }: { items: Array<{ id: string; name: string }> }) => {
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })

    const visibleItems = useMemo(() => {
      return items.slice(visibleRange.start, visibleRange.end)
    }, [items, visibleRange])

    return (
      <div data-testid="virtual-list">
        <ul>
          {visibleItems.map(item => (
            <li key={item.id} data-testid={`item-${item.id}`}>
              {item.name}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  it('renders only visible items for large lists', () => {
    const largeList = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
    }))

    render(<TestVirtualizedList items={largeList} />)

    const list = screen.getByTestId('virtual-list')
    const items = list.querySelectorAll('li')

    expect(items.length).toBeLessThan(1000)
    expect(items.length).toBeLessThanOrEqual(50)
  })

  it('renders first 50 items by default', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
    }))

    render(<TestVirtualizedList items={items} />)

    expect(screen.getByTestId('item-0')).toBeInTheDocument()
    expect(screen.getByTestId('item-49')).toBeInTheDocument()
    expect(screen.queryByTestId('item-50')).not.toBeInTheDocument()
  })

  it('handles items with different content lengths', () => {
    const items = [
      { id: '1', name: 'Short' },
      { id: '2', name: 'This is a much longer item name' },
      { id: '3', name: 'M' },
    ]

    render(<TestVirtualizedList items={items} />)

    expect(screen.getByText('Short')).toBeInTheDocument()
    expect(screen.getByText('This is a much longer item name')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
  })
})
