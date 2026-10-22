import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable, type Column } from './DataTable'

interface Row {
  id: string
  name: string
  amount: number
}

const rows: Row[] = [
  { id: '1', name: 'Charlie', amount: 30 },
  { id: '2', name: 'Alice', amount: 10 },
  { id: '3', name: 'Bob', amount: 20 },
]

const columns: Column<Row>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'amount', label: 'Amount' },
]

function firstColumnOrder() {
  return [0, 1, 2].map(i => within(screen.getByTestId(`table-row-${i}`)).getAllByRole('cell')[0].textContent)
}

describe('DataTable keyboard and ARIA semantics (#1469)', () => {
  describe('sortable headers', () => {
    it('renders sort controls as real buttons inside sortable headers only', () => {
      render(<DataTable data={rows} columns={columns} />)

      const sortButton = screen.getByRole('button', { name: 'Sort by Name' })
      const header = sortButton.closest('th')

      expect(sortButton.tagName).toBe('BUTTON')
      expect(header).not.toBeNull()
      expect(screen.getAllByRole('button', { name: /^Sort by/ })).toHaveLength(1)
    })

    it('cycles ascending, descending, then unsorted when the header button is activated', async () => {
      const user = userEvent.setup()
      render(<DataTable data={rows} columns={columns} />)

      const sortButton = screen.getByRole('button', { name: 'Sort by Name' })

      expect(firstColumnOrder()).toEqual(['Charlie', 'Alice', 'Bob'])

      await user.click(sortButton)
      expect(firstColumnOrder()).toEqual(['Alice', 'Bob', 'Charlie'])

      await user.click(sortButton)
      expect(firstColumnOrder()).toEqual(['Charlie', 'Bob', 'Alice'])

      await user.click(sortButton)
      expect(firstColumnOrder()).toEqual(['Charlie', 'Alice', 'Bob'])
    })

    it('sorts the column that was activated via keyboard Enter on the header button', async () => {
      const user = userEvent.setup()
      render(<DataTable data={rows} columns={columns} />)

      screen.getByRole('button', { name: 'Sort by Name' }).focus()
      await user.keyboard('{Enter}')

      expect(firstColumnOrder()).toEqual(['Alice', 'Bob', 'Charlie'])
    })
  })

  describe('pending work (requirements not yet met)', () => {
    it.fails('exposes aria-sort on the sorted header', async () => {
      // Fails until headers set aria-sort. Remove `.fails` once implemented.
      const user = userEvent.setup()
      render(<DataTable data={rows} columns={columns} />)

      await user.click(screen.getByRole('button', { name: 'Sort by Name' }))

      expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
        'aria-sort',
        'ascending'
      )
    })

    it.fails('moves focus to the same column in the next row on ArrowDown', async () => {
      // Fails until arrow-key navigation is added. Remove `.fails` once implemented.
      const user = userEvent.setup()
      render(<DataTable data={rows} columns={columns} />)

      const firstCell = within(screen.getByTestId('table-row-0')).getAllByRole('cell')[0]
      firstCell.focus()
      await user.keyboard('{ArrowDown}')

      expect(within(screen.getByTestId('table-row-1')).getAllByRole('cell')[0]).toHaveFocus()
    })

    it.fails('uses roving tabindex so only one body cell is tabbable', () => {
      // Fails until roving tabindex is added. Remove `.fails` once implemented.
      render(<DataTable data={rows} columns={columns} />)

      const tabbable = screen
        .getAllByRole('cell')
        .filter(cell => cell.getAttribute('tabindex') === '0')

      expect(tabbable).toHaveLength(1)
    })
  })
})
