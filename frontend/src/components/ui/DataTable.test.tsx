import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DataTable, Column, DataTableProps } from './DataTable'

interface TestData {
  id: string | number
  name: string
  email: string
  status: string
  amount: number
  createdAt: string
}

const mockData: TestData[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    status: 'active',
    amount: 150.5,
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    status: 'inactive',
    amount: 200.0,
    createdAt: '2024-02-20',
  },
  {
    id: '3',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    status: 'active',
    amount: 175.25,
    createdAt: '2024-03-10',
  },
  {
    id: '4',
    name: 'Diana Prince',
    email: 'diana@example.com',
    status: 'pending',
    amount: 125.0,
    createdAt: '2024-04-05',
  },
  {
    id: '5',
    name: 'Edward Norton',
    email: 'edward@example.com',
    status: 'active',
    amount: 300.75,
    createdAt: '2024-05-12',
  },
]

const mockColumns: Column<TestData>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'amount', label: 'Amount', sortable: true },
]

describe('DataTable Component', () => {
  describe('Basic Rendering', () => {
    it('should render table with columns and data', () => {
      render(<DataTable data={mockData} columns={mockColumns} />)

      expect(screen.getByTestId('data-table')).toBeInTheDocument()
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Amount')).toBeInTheDocument()
    })

    it('should render all rows from data array', () => {
      render(<DataTable data={mockData} columns={mockColumns} />)

      mockData.forEach(row => {
        expect(screen.getByText(row.name)).toBeInTheDocument()
        expect(screen.getByText(row.email)).toBeInTheDocument()
      })
    })

    it('should render custom table ID', () => {
      render(<DataTable data={mockData} columns={mockColumns} testId="custom-table" />)

      expect(screen.getByTestId('custom-table')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should render empty state when data is empty', () => {
      render(<DataTable data={[]} columns={mockColumns} />)

      expect(screen.getByTestId('data-table-empty')).toBeInTheDocument()
      expect(screen.getByText('No data available')).toBeInTheDocument()
    })

    it('should render custom empty state message', () => {
      const customMessage = 'No items found'
      render(
        <DataTable
          data={[]}
          columns={mockColumns}
          emptyStateMessage={customMessage}
        />
      )

      expect(screen.getByText(customMessage)).toBeInTheDocument()
    })

    it('should not render table headers when empty', () => {
      render(<DataTable data={[]} columns={mockColumns} />)

      const tables = screen.queryAllByRole('table')
      expect(tables.length).toBe(0)
    })
  })

  describe('Sorting', () => {
    it('should sort by string column in ascending order', async () => {
      render(<DataTable data={mockData} columns={mockColumns} pageSize={5} />)

      const nameSort = screen.getByTestId('sort-button-name')
      fireEvent.click(nameSort)

      await waitFor(() => {
        const rows = screen.getAllByTestId(/^table-row-/)
        expect(rows[0]).toHaveTextContent('Alice')
        expect(rows[1]).toHaveTextContent('Bob')
      })
    })

    it('should sort by string column in descending order', async () => {
      render(<DataTable data={mockData} columns={mockColumns} pageSize={5} />)

      const nameSort = screen.getByTestId('sort-button-name')
      fireEvent.click(nameSort)
      fireEvent.click(nameSort)

      await waitFor(() => {
        const rows = screen.getAllByTestId(/^table-row-/)
        expect(rows[0]).toHaveTextContent('Edward')
      })
    })

    it('should clear sort when clicking sort button third time', async () => {
      render(<DataTable data={mockData} columns={mockColumns} pageSize={5} />)

      const nameSort = screen.getByTestId('sort-button-name')

      fireEvent.click(nameSort)
      fireEvent.click(nameSort)
      fireEvent.click(nameSort)

      await waitFor(() => {
        const rows = screen.getAllByTestId(/^table-row-/)
        expect(rows[0]).toHaveTextContent('Alice')
      })
    })

    it('should sort by numeric column in ascending order', async () => {
      render(<DataTable data={mockData} columns={mockColumns} pageSize={5} />)

      const amountSort = screen.getByTestId('sort-button-amount')
      fireEvent.click(amountSort)

      await waitFor(() => {
        const rows = screen.getAllByTestId(/^table-row-/)
        expect(rows[0]).toHaveTextContent('125')
      })
    })

    it('should sort by numeric column in descending order', async () => {
      render(<DataTable data={mockData} columns={mockColumns} pageSize={5} />)

      const amountSort = screen.getByTestId('sort-button-amount')
      fireEvent.click(amountSort)
      fireEvent.click(amountSort)

      await waitFor(() => {
        const rows = screen.getAllByTestId(/^table-row-/)
        expect(rows[0]).toHaveTextContent('300.75')
      })
    })

    it('should not show sort button for non-sortable columns', () => {
      render(<DataTable data={mockData} columns={mockColumns} />)

      expect(screen.queryByTestId('sort-button-status')).not.toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('should maintain sort after pagination', async () => {
      const largeData = Array.from({ length: 25 }, (_, i) => ({
        ...mockData[0],
        id: String(i),
        name: String.fromCharCode(65 + (i % 26)).repeat(3 + (i % 3)),
      }))

      render(<DataTable data={largeData} columns={mockColumns} pageSize={10} />)

      const nameSort = screen.getByTestId('sort-button-name')
      fireEvent.click(nameSort)

      await waitFor(() => {
        const nextPageBtn = screen.getByTestId('pagination-next')
        fireEvent.click(nextPageBtn)
      })

      await waitFor(() => {
        expect(screen.getByText('Showing 11 to 20')).toBeInTheDocument()
      })
    })
  })

  describe('Pagination', () => {
    const paginationData = Array.from({ length: 25 }, (_, i) => ({
      ...mockData[0],
      id: String(i),
      name: `User ${i}`,
    }))

    it('should render pagination controls when data exceeds page size', () => {
      render(<DataTable data={paginationData} columns={mockColumns} pageSize={10} />)

      expect(screen.getByTestId('data-table-pagination')).toBeInTheDocument()
    })

    it('should not render pagination controls with less data than page size', () => {
      render(<DataTable data={mockData} columns={mockColumns} pageSize={10} />)

      expect(screen.queryByTestId('data-table-pagination')).not.toBeInTheDocument()
    })

    it('should show correct initial page range', () => {
      render(<DataTable data={paginationData} columns={mockColumns} pageSize={10} />)

      expect(screen.getByText('Showing 1 to 10 of 25')).toBeInTheDocument()
    })

    it('should navigate to next page', async () => {
      render(<DataTable data={paginationData} columns={mockColumns} pageSize={10} />)

      const nextButton = screen.getByTestId('pagination-next')
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText('Showing 11 to 20 of 25')).toBeInTheDocument()
      })
    })

    it('should navigate to previous page', async () => {
      render(<DataTable data={paginationData} columns={mockColumns} pageSize={10} />)

      const nextButton = screen.getByTestId('pagination-next')
      fireEvent.click(nextButton)

      await waitFor(() => {
        const prevButton = screen.getByTestId('pagination-prev')
        fireEvent.click(prevButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Showing 1 to 10 of 25')).toBeInTheDocument()
      })
    })

    it('should disable previous button on first page', () => {
      render(<DataTable data={paginationData} columns={mockColumns} pageSize={10} />)

      const prevButton = screen.getByTestId('pagination-prev')
      expect(prevButton).toBeDisabled()
    })

    it('should disable next button on last page', async () => {
      render(<DataTable data={paginationData} columns={mockColumns} pageSize={10} />)

      const nextButton = screen.getByTestId('pagination-next')
      fireEvent.click(nextButton)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(nextButton).toBeDisabled()
      })
    })

    it('should navigate to specific page using page buttons', async () => {
      render(<DataTable data={paginationData} columns={mockColumns} pageSize={10} />)

      const page3Button = screen.getByTestId('pagination-page-3')
      fireEvent.click(page3Button)

      await waitFor(() => {
        expect(screen.getByText('Showing 21 to 25 of 25')).toBeInTheDocument()
      })
    })

    it('should highlight current page button', async () => {
      render(<DataTable data={paginationData} columns={mockColumns} pageSize={10} />)

      const page1Button = screen.getByTestId('pagination-page-1')
      expect(page1Button).toHaveClass('bg-blue-500')

      const page2Button = screen.getByTestId('pagination-page-2')
      fireEvent.click(page2Button)

      await waitFor(() => {
        expect(page1Button).not.toHaveClass('bg-blue-500')
        expect(page2Button).toHaveClass('bg-blue-500')
      })
    })
  })

  describe('Custom Rendering', () => {
    it('should use custom render function for column', () => {
      const customColumns: Column<TestData>[] = [
        { key: 'name', label: 'Name', sortable: true },
        {
          key: 'status',
          label: 'Status',
          render: (value) => <span className="badge">{value.toUpperCase()}</span>,
        },
      ]

      render(<DataTable data={mockData} columns={customColumns} />)

      expect(screen.getByText('ACTIVE')).toBeInTheDocument()
      expect(screen.getByText('INACTIVE')).toBeInTheDocument()
    })

    it('should provide row data to custom render function', () => {
      const customColumns: Column<TestData>[] = [
        {
          key: 'name',
          label: 'Name',
          render: (value, row) => `${value} (${row.email})`,
        },
      ]

      render(<DataTable data={mockData} columns={customColumns} />)

      expect(screen.getByText('Alice Johnson (alice@example.com)')).toBeInTheDocument()
    })
  })

  describe('Row Click Handler', () => {
    it('should call onRowClick when row is clicked', async () => {
      const onRowClick = vi.fn()
      render(<DataTable data={mockData} columns={mockColumns} onRowClick={onRowClick} />)

      const firstRow = screen.getByTestId('table-row-0')
      fireEvent.click(firstRow)

      await waitFor(() => {
        expect(onRowClick).toHaveBeenCalledWith(mockData[0])
      })
    })

    it('should add hover style to clickable rows', () => {
      const onRowClick = vi.fn()
      render(<DataTable data={mockData} columns={mockColumns} onRowClick={onRowClick} />)

      const firstRow = screen.getByTestId('table-row-0')
      expect(firstRow).toHaveClass('cursor-pointer')
    })
  })

  describe('Column Width', () => {
    it('should apply custom column width', () => {
      const customColumns: Column<TestData>[] = [
        { key: 'name', label: 'Name', sortable: true, width: '30%' },
        { key: 'email', label: 'Email', sortable: true, width: '70%' },
      ]

      const { container } = render(<DataTable data={mockData} columns={customColumns} />)

      const headers = container.querySelectorAll('th')
      expect(headers[0]).toHaveStyle('width: 30%')
      expect(headers[1]).toHaveStyle('width: 70%')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for sort buttons', () => {
      render(<DataTable data={mockData} columns={mockColumns} />)

      const nameSort = screen.getByTestId('sort-button-name')
      expect(nameSort).toHaveAttribute('aria-label', 'Sort by Name')
    })

    it('should render table with semantic HTML', () => {
      render(<DataTable data={mockData} columns={mockColumns} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0)
    })
  })

  describe('CSS Classes', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <DataTable data={mockData} columns={mockColumns} className="custom-class" />
      )

      const wrapper = screen.getByTestId('data-table')
      expect(wrapper).toHaveClass('custom-class')
    })
  })

  describe('Edge Cases', () => {
    it('should handle data with null values', () => {
      const dataWithNull: TestData[] = [
        {
          id: '1',
          name: 'Alice',
          email: 'alice@example.com',
          status: 'active',
          amount: 150.5,
          createdAt: '2024-01-15',
        },
        {
          id: '2',
          name: null as any,
          email: 'bob@example.com',
          status: 'inactive',
          amount: null as any,
          createdAt: '2024-02-20',
        },
      ]

      render(<DataTable data={dataWithNull} columns={mockColumns} />)

      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    })

    it('should handle sorting with null values', async () => {
      const dataWithNull: TestData[] = [
        { ...mockData[0], amount: 100 },
        { ...mockData[1], amount: null as any },
        { ...mockData[2], amount: 200 },
      ]

      render(<DataTable data={dataWithNull} columns={mockColumns} pageSize={5} />)

      const amountSort = screen.getByTestId('sort-button-amount')
      fireEvent.click(amountSort)

      await waitFor(() => {
        const rows = screen.getAllByTestId(/^table-row-/)
        expect(rows[0]).toHaveTextContent('100')
      })
    })

    it('should handle page size of 1', () => {
      render(<DataTable data={mockData} columns={mockColumns} pageSize={1} />)

      expect(screen.getByText('Showing 1 to 1 of 5')).toBeInTheDocument()
    })
  })
})
