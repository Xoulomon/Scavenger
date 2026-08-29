/**
 * MSW server for Vitest (Node.js environment).
 *
 * Lifecycle:
 *   beforeAll  → server.listen()  (start intercepting)
 *   afterEach  → server.resetHandlers()  (clear per-test overrides)
 *   afterAll   → server.close()  (stop intercepting)
 *
 * Import this in test files that need HTTP mocking:
 *   import { server } from '@/test/msw/server'
 */
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
