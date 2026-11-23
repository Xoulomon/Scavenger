import React from 'react'
import { AuthConfig } from './types'

interface Props {
  auth: AuthConfig
  onChange: (auth: AuthConfig) => void
}

export const AuthConfigPanel: React.FC<Props> = ({ auth, onChange }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 w-24">Auth type</label>
        <select
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={auth.type}
          onChange={(e) => onChange({ ...auth, type: e.target.value as AuthConfig['type'] })}
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="api_key">API Key</option>
          <option value="stellar">Stellar Public Key</option>
        </select>
      </div>

      {auth.type === 'bearer' && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-24">Token</label>
          <input
            type="password"
            placeholder="eyJ..."
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={auth.token ?? ''}
            onChange={(e) => onChange({ ...auth, token: e.target.value })}
          />
        </div>
      )}

      {auth.type === 'api_key' && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-24">API Key</label>
          <input
            type="password"
            placeholder="sk-..."
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={auth.apiKey ?? ''}
            onChange={(e) => onChange({ ...auth, apiKey: e.target.value })}
          />
        </div>
      )}

      {auth.type === 'stellar' && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-24">Public Key</label>
          <input
            type="text"
            placeholder="GXXXX..."
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={auth.stellarPublicKey ?? ''}
            onChange={(e) => onChange({ ...auth, stellarPublicKey: e.target.value })}
          />
        </div>
      )}

      {auth.type === 'none' && (
        <p className="text-xs text-gray-400 italic">
          No authentication will be applied to this request.
        </p>
      )}
    </div>
  )
}
