// Shared API playground types live in packages/ so they can be reused across
// the frontend and any other consumers. Re-exported here for backwards
// compatibility with existing imports from this module.
export type {
  HttpMethod,
  Header,
  QueryParam,
  AuthConfig,
  ApiRequest,
  ApiResponse,
  HistoryEntry,
  ExampleRequest
} from '@greenledger/packages/api-playground-types'

import type { ExampleRequest } from '@greenledger/packages/api-playground-types'

export const EXAMPLE_REQUESTS: ExampleRequest[] = [
  {
    id: 'ex-1',
    category: 'Contracts',
    name: 'List Wastes',
    description: 'Fetch paginated list of waste records',
    request: {
      method: 'GET',
      url: '/api/contracts/wastes',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      queryParams: [
        { key: 'page', value: '1', enabled: true },
        { key: 'limit', value: '20', enabled: true }
      ],
      body: '',
      auth: { type: 'none' }
    }
  },
  {
    id: 'ex-2',
    category: 'Contracts',
    name: 'Get Contract Stats',
    description: 'Retrieve overall contract statistics',
    request: {
      method: 'GET',
      url: '/api/contracts/stats',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      queryParams: [],
      body: '',
      auth: { type: 'none' }
    }
  },
  {
    id: 'ex-3',
    category: 'Analytics',
    name: 'Get Analytics',
    description: 'Fetch analytics metrics for a participant',
    request: {
      method: 'GET',
      url: '/api/analytics',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      queryParams: [{ key: 'participant_id', value: 'GXXXX...', enabled: true }],
      body: '',
      auth: { type: 'bearer' }
    }
  },
  {
    id: 'ex-4',
    category: 'Export',
    name: 'Export CSV',
    description: 'Export waste data as CSV',
    request: {
      method: 'POST',
      url: '/api/export',
      headers: [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'Accept', value: 'application/json', enabled: true }
      ],
      queryParams: [],
      body: JSON.stringify({ format: 'csv', data_type: 'wastes', anonymize: false }, null, 2),
      auth: { type: 'bearer' }
    }
  },
  {
    id: 'ex-5',
    category: 'Audit',
    name: 'Get Audit Logs',
    description: 'Retrieve recent audit log entries',
    request: {
      method: 'GET',
      url: '/api/audit',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      queryParams: [
        { key: 'page', value: '1', enabled: true },
        { key: 'limit', value: '50', enabled: true }
      ],
      body: '',
      auth: { type: 'bearer' }
    }
  },
  {
    id: 'ex-6',
    category: 'Verification',
    name: 'Verify Record',
    description: 'Submit a waste record for verification',
    request: {
      method: 'POST',
      url: '/api/verification/verify',
      headers: [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'X-CSRF-Token', value: '<csrf-token>', enabled: true }
      ],
      queryParams: [],
      body: JSON.stringify({ record_id: 'waste-001', verifier_id: 'GXXXX...' }, null, 2),
      auth: { type: 'bearer' }
    }
  }
]
