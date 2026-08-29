import React, { useState, useRef } from 'react'
import { CheckSquare, Square, Trash2, Send, Check, Tag, Download } from 'lucide-react'
import { cn } from '@/lib/cn'
import { BATCH_OPERATIONS, BatchOperation } from '@/lib/batchOperations'

interface BatchOperationsUIProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  onExecuteOperation: (operation: string, params?: Record<string, unknown>) => Promise<void>
  isLoading?: boolean
}

interface ConfirmDialogState {
  isOpen: boolean
  operation?: BatchOperation
  params?: Record<string, unknown>
}

const getOperationIcon = (operationId: string) => {
  switch (operationId) {
    case 'transfer':
      return <Send className="w-4 h-4" aria-hidden="true" />
    case 'verify':
      return <Check className="w-4 h-4" aria-hidden="true" />
    case 'delete':
      return <Trash2 className="w-4 h-4" aria-hidden="true" />
    case 'export':
      return <Download className="w-4 h-4" aria-hidden="true" />
    case 'tag':
      return <Tag className="w-4 h-4" aria-hidden="true" />
    default:
      return null
  }
}

export const BatchOperationsUI: React.FC<BatchOperationsUIProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onExecuteOperation,
  isLoading = false,
}) => {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
  })
  const [tagInput, setTagInput] = useState('')

  // Ref to the button that opened the confirm modal — focus is returned on close
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null)

  const handleOperationClick = (operation: BatchOperation, buttonEl: HTMLButtonElement) => {
    lastTriggerRef.current = buttonEl
    if (operation.requiresConfirmation) {
      setConfirmDialog({ isOpen: true, operation })
    } else if (operation.id === 'tag') {
      setConfirmDialog({ isOpen: true, operation, params: { tag: tagInput } })
    } else {
      executeOperation(operation)
    }
  }

  const executeOperation = async (operation: BatchOperation) => {
    try {
      await onExecuteOperation(operation.id, confirmDialog.params)
      closeConfirm()
      setTagInput('')
    } catch (error) {
      console.error('Operation failed:', error)
    }
  }

  const closeConfirm = () => {
    setConfirmDialog({ isOpen: false })
    // Restore focus to the triggering button
    setTimeout(() => lastTriggerRef.current?.focus(), 0)
  }

  const isAllSelected = selectedCount === totalCount && totalCount > 0
  const hasSelection = selectedCount > 0
  const operation = confirmDialog.operation

  return (
    <div className="space-y-4">
      {/* Selection Header */}
      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={isAllSelected ? onDeselectAll : onSelectAll}
            className="p-1 hover:bg-blue-100 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isAllSelected ? 'Deselect all items' : 'Select all items'}
            aria-pressed={isAllSelected}
          >
            {isAllSelected ? (
              <CheckSquare className="w-5 h-5 text-blue-600" aria-hidden="true" />
            ) : (
              <Square className="w-5 h-5 text-gray-400" aria-hidden="true" />
            )}
          </button>
          <span className="text-sm font-medium text-gray-700">
            {selectedCount} of {totalCount} selected
          </span>
        </div>
        {hasSelection && (
          <button
            onClick={onDeselectAll}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label="Clear selection"
          >
            Clear
          </button>
        )}
      </div>

      {/* Batch Operations */}
      {hasSelection && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Batch Actions</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {BATCH_OPERATIONS.map((op) => (
              <button
                key={op.id}
                onClick={(e) => handleOperationClick(op, e.currentTarget)}
                disabled={isLoading}
                aria-label={`${op.name} ${selectedCount} selected item${selectedCount !== 1 ? 's' : ''}`}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  op.id === 'delete'
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 disabled:bg-red-50 disabled:opacity-50'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-100 disabled:opacity-50'
                )}
              >
                <span aria-hidden="true">{getOperationIcon(op.id)}</span>
                <span>{op.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tag Input (shown when tag operation is selected) */}
      {confirmDialog.operation?.id === 'tag' && confirmDialog.isOpen && (
        <div className="space-y-2">
          <label htmlFor="batch-tag-input" className="text-sm font-medium text-gray-700">
            Tag name
          </label>
          <input
            id="batch-tag-input"
            type="text"
            placeholder="Enter tag name"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && operation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConfirm()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-confirm-title"
            aria-describedby="batch-confirm-desc"
            className="bg-white rounded-lg p-6 max-w-sm mx-4 space-y-4"
          >
            <h3 id="batch-confirm-title" className="text-lg font-semibold text-gray-900">
              Confirm {operation.name}
            </h3>
            <p id="batch-confirm-desc" className="text-sm text-gray-600">
              {operation.description}
            </p>
            <p className="text-sm font-medium text-gray-700">
              This will affect {selectedCount} item{selectedCount !== 1 ? 's' : ''}.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </button>
              <button
                onClick={() => executeOperation(operation)}
                disabled={isLoading || (operation.id === 'tag' && !tagInput.trim())}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  operation.id === 'delete'
                    ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                )}
              >
                {isLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BatchOperationsUI
