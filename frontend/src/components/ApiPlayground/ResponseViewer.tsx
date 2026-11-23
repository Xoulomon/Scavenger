import React, { useState } from 'react'
import { ApiResponse } from './types'

interface Props {
  response: ApiResponse | null
  error: string | null
  loading: boolean
}

type ViewTab = 'body' | 'headers'

function statusColor(code: number): string {
  if (code < 300) return 'text-emerald-600 bg-emerald-50'
  if (code < 400) return 'text-blue-600 bg-blue-50'
  if (code < 500) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export const ResponseViewer: React.FC<Props> = ({ response, error, loading }) => {
  const [tab, setTab] = useState<ViewTab>('body')
  const [copied, setCopied] = useState(false)

  const copyBody = () => {
    if (!response) return
    navigator.clipboard.writeText(prettyJson(response.body))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Sending request…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 shadow-sm p-4">
        <p className="text-sm font-medium text-red-600 mb-1">Request failed</p>
        <pre className="text-xs text-red-500 whitespace-pre-wrap break-all">{error}</pre>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 flex items-center justify-center">
        <p className="text-sm text-gray-400">Send a request to see the response here.</p>
      </div>
    )
  }

  const activeTab = 'border-b-2 border-emerald-500 text-emerald-600 font-medium'
  const inactiveTab = 'text-gray-500 hover:text-gray-700'

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-200">
        <span
          className={`text-sm font-semibold px-2 py-0.5 rounded ${statusColor(response.status)}`}
        >
          {response.status} {response.statusText}
        </span>
        <span className="text-xs text-gray-400">{response.durationMs} ms</span>
        <span className="text-xs text-gray-400">
          {new Date(response.timestamp).toLocaleTimeString()}
        </span>
        <button
          onClick={copyBody}
          className="ml-auto text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 px-4 border-b border-gray-200 text-sm">
        {(['body', 'headers'] as ViewTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 capitalize ${tab === t ? activeTab : inactiveTab}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {tab === 'body' && (
          <pre className="text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap break-all text-gray-800">
            {prettyJson(response.body)}
          </pre>
        )}

        {tab === 'headers' && (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-1 pr-4 font-medium">Name</th>
                <th className="pb-1 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(response.headers).map(([k, v]) => (
                <tr key={k} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-1 pr-4 text-emerald-700">{k}</td>
                  <td className="py-1 text-gray-700 break-all">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
