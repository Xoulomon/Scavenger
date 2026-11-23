import React from 'react'
import { HistoryEntry, HttpMethod } from './types'

interface Props {
  history: HistoryEntry[]
  onSelect: (entry: HistoryEntry) => void
  onClear: () => void
}

const METHOD_BADGE: Record<HttpMethod, string> = {
  GET: 'bg-emerald-100 text-emerald-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  PATCH: 'bg-purple-100 text-purple-700',
  DELETE: 'bg-red-100 text-red-700'
}

function statusBadge(status: number | undefined): string {
  if (!status) return 'bg-gray-100 text-gray-500'
  if (status < 300) return 'bg-emerald-100 text-emerald-700'
  if (status < 500) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

export const RequestHistory: React.FC<Props> = ({ history, onSelect, onClear }) => {
  if (history.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
        <p className="text-sm text-gray-400">No requests yet. Send one to build history.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">History ({history.length})</span>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-red-500">
          Clear all
        </button>
      </div>

      <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {[...history].reverse().map((entry) => (
          <li key={entry.id}>
            <button
              onClick={() => onSelect(entry)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded ${METHOD_BADGE[entry.request.method]}`}
                >
                  {entry.request.method}
                </span>
                <span className="text-xs font-mono text-gray-700 truncate max-w-xs">
                  {entry.request.url}
                </span>
                {entry.response && (
                  <span
                    className={`ml-auto text-xs font-semibold px-1.5 py-0.5 rounded ${statusBadge(entry.response.status)}`}
                  >
                    {entry.response.status}
                  </span>
                )}
                {entry.error && (
                  <span className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                    ERR
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                {entry.response && <span>{entry.response.durationMs} ms</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
