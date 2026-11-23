import React, { useState } from 'react'
import { ApiRequest, Header, HttpMethod, QueryParam } from './types'
import { AuthConfigPanel } from './AuthConfig'

interface Props {
  request: ApiRequest
  onChange: (req: ApiRequest) => void
  onSend: () => void
  loading: boolean
}

type Tab = 'params' | 'headers' | 'body' | 'auth'

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-emerald-600',
  POST: 'text-blue-600',
  PUT: 'text-amber-600',
  PATCH: 'text-purple-600',
  DELETE: 'text-red-600'
}

export const RequestBuilder: React.FC<Props> = ({ request, onChange, onSend, loading }) => {
  const [tab, setTab] = useState<Tab>('params')

  const updateHeader = (idx: number, patch: Partial<Header>) => {
    const headers = [...request.headers]
    headers[idx] = { ...headers[idx], ...patch }
    onChange({ ...request, headers })
  }

  const addHeader = () =>
    onChange({ ...request, headers: [...request.headers, { key: '', value: '', enabled: true }] })

  const removeHeader = (idx: number) =>
    onChange({ ...request, headers: request.headers.filter((_, i) => i !== idx) })

  const updateParam = (idx: number, patch: Partial<QueryParam>) => {
    const queryParams = [...request.queryParams]
    queryParams[idx] = { ...queryParams[idx], ...patch }
    onChange({ ...request, queryParams })
  }

  const addParam = () =>
    onChange({
      ...request,
      queryParams: [...request.queryParams, { key: '', value: '', enabled: true }]
    })

  const removeParam = (idx: number) =>
    onChange({ ...request, queryParams: request.queryParams.filter((_, i) => i !== idx) })

  const activeTabClass = 'border-b-2 border-emerald-500 text-emerald-600 font-medium'
  const inactiveTabClass = 'text-gray-500 hover:text-gray-700'

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* URL Bar */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200">
        <select
          value={request.method}
          onChange={(e) => onChange({ ...request, method: e.target.value as HttpMethod })}
          className={`font-mono font-semibold text-sm rounded border border-gray-300 px-2 py-1.5 w-24 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${METHOD_COLORS[request.method]}`}
        >
          {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={request.url}
          onChange={(e) => onChange({ ...request, url: e.target.value })}
          placeholder="/api/contracts/wastes"
          className="flex-1 font-mono text-sm rounded border border-gray-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <button
          onClick={onSend}
          disabled={loading || !request.url.trim()}
          className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 px-4 border-b border-gray-200 text-sm">
        {(['params', 'headers', 'body', 'auth'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 capitalize ${tab === t ? activeTabClass : inactiveTabClass}`}
          >
            {t}
            {t === 'params' && request.queryParams.filter((p) => p.enabled).length > 0 && (
              <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 rounded-full px-1.5">
                {request.queryParams.filter((p) => p.enabled).length}
              </span>
            )}
            {t === 'headers' && request.headers.filter((h) => h.enabled).length > 0 && (
              <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 rounded-full px-1.5">
                {request.headers.filter((h) => h.enabled).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="p-4">
        {tab === 'params' && (
          <KeyValueTable
            rows={request.queryParams}
            onUpdate={updateParam}
            onAdd={addParam}
            onRemove={removeParam}
            keyPlaceholder="parameter"
            valuePlaceholder="value"
          />
        )}

        {tab === 'headers' && (
          <KeyValueTable
            rows={request.headers}
            onUpdate={updateHeader}
            onAdd={addHeader}
            onRemove={removeHeader}
            keyPlaceholder="Header-Name"
            valuePlaceholder="value"
          />
        )}

        {tab === 'body' && (
          <div className="space-y-2">
            {['GET', 'DELETE'].includes(request.method) && (
              <p className="text-xs text-amber-600">
                {request.method} requests typically have no body.
              </p>
            )}
            <textarea
              value={request.body}
              onChange={(e) => onChange({ ...request, body: e.target.value })}
              placeholder={'{\n  "key": "value"\n}'}
              rows={10}
              className="w-full font-mono text-sm rounded border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
            />
          </div>
        )}

        {tab === 'auth' && (
          <AuthConfigPanel
            auth={request.auth}
            onChange={(auth) => onChange({ ...request, auth })}
          />
        )}
      </div>
    </div>
  )
}

interface KVRow {
  key: string
  value: string
  enabled: boolean
}

interface KeyValueTableProps {
  rows: KVRow[]
  onUpdate: (idx: number, patch: Partial<KVRow>) => void
  onAdd: () => void
  onRemove: (idx: number) => void
  keyPlaceholder: string
  valuePlaceholder: string
}

const KeyValueTable: React.FC<KeyValueTableProps> = ({
  rows,
  onUpdate,
  onAdd,
  onRemove,
  keyPlaceholder,
  valuePlaceholder
}) => (
  <div className="space-y-2">
    {rows.map((row, idx) => (
      <div key={idx} className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={row.enabled}
          onChange={(e) => onUpdate(idx, { enabled: e.target.checked })}
          className="rounded border-gray-300 text-emerald-600"
        />
        <input
          type="text"
          value={row.key}
          onChange={(e) => onUpdate(idx, { key: e.target.value })}
          placeholder={keyPlaceholder}
          className="flex-1 font-mono text-sm rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <input
          type="text"
          value={row.value}
          onChange={(e) => onUpdate(idx, { value: e.target.value })}
          placeholder={valuePlaceholder}
          className="flex-1 font-mono text-sm rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={() => onRemove(idx)}
          className="text-gray-400 hover:text-red-500 text-lg leading-none"
          aria-label="Remove row"
        >
          ×
        </button>
      </div>
    ))}
    <button onClick={onAdd} className="text-sm text-emerald-600 hover:text-emerald-800 font-medium">
      + Add
    </button>
  </div>
)
