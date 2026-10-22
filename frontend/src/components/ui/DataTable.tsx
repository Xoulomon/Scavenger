import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: keyof T
  label: string
  sortable?: boolean
  render?: (value: T[keyof T], row: T) => React.ReactNode
  width?: string
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  pageSize?: number
  className?: string
  emptyStateMessage?: string
  onRowClick?: (row: T) => void
  testId?: string
}

type SortDirection = 'asc' | 'desc' | null

interface SortState {
  key: PropertyKey | null
  direction: SortDirection
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  pageSize = 10,
  className,
  emptyStateMessage = 'No data available',
  onRowClick,
  testId = 'data-table',
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortState, setSortState] = useState<SortState>({ key: null, direction: null })

  const sortedData = useMemo(() => {
    if (!sortState.key || !sortState.direction) {
      return data
    }

    return [...data].sort((a, b) => {
      const aValue = a[sortState.key as keyof T]
      const bValue = b[sortState.key as keyof T]

      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortState.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortState.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      if (aValue < bValue) return sortState.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortState.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortState])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return sortedData.slice(startIndex, endIndex)
  }, [sortedData, currentPage, pageSize])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (columnKey: keyof T) => {
    if (sortState.key === columnKey) {
      if (sortState.direction === 'asc') {
        setSortState({ key: columnKey, direction: 'desc' })
      } else if (sortState.direction === 'desc') {
        setSortState({ key: null, direction: null })
      }
    } else {
      setSortState({ key: columnKey, direction: 'asc' })
    }
    setCurrentPage(1)
  }

  const getSortIcon = (columnKey: keyof T) => {
    if (sortState.key !== columnKey) {
      return <ChevronsUpDown className="h-4 w-4" />
    }
    return sortState.direction === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  if (data.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center py-8 text-gray-500', className)}
        data-testid={`${testId}-empty`}
      >
        <p>{emptyStateMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)} data-testid={testId}>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map(column => (
                <th
                  key={String(column.key)}
                  className="px-4 py-3 text-left font-semibold text-gray-700"
                  style={{ width: column.width }}
                >
                  {column.sortable && column.sortable !== false ? (
                    <button
                      onClick={() => handleSort(column.key)}
                      className={cn(
                        'flex items-center gap-1 hover:text-gray-900 transition-colors',
                        sortState.key === column.key ? 'text-gray-900' : 'text-gray-700'
                      )}
                      data-testid={`sort-button-${String(column.key)}`}
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {getSortIcon(column.key)}
                    </button>
                  ) : (
                    <span>{column.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.map((row, rowIndex) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn('bg-white', onRowClick && 'cursor-pointer hover:bg-gray-50')}
                data-testid={`table-row-${rowIndex}`}
              >
                {columns.map(column => (
                  <td
                    key={`${row.id}-${String(column.key)}`}
                    className="px-4 py-3 text-gray-800"
                    style={{ width: column.width }}
                  >
                    {column.render ? column.render(row[column.key], row) : String(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          className="flex items-center justify-between text-sm text-gray-600"
          data-testid={`${testId}-pagination`}
        >
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pagination-prev"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    'px-2 py-1 rounded border text-sm',
                    currentPage === pageNum
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-300 hover:bg-gray-50'
                  )}
                  data-testid={`pagination-page-${pageNum}`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pagination-next"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
