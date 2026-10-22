/**
 * MSW browser worker for Storybook (#1546).
 *
 * Stories run in a real browser, so they use msw/browser (a Service Worker)
 * instead of msw/node.  This module creates a single worker instance that
 * the Storybook preview.ts initialises once on start-up.
 *
 * The same handlers used in Vitest unit tests (src/test-utils/msw/handlers.ts)
 * are reused here — one source of truth for all API mocks.
 */
import { setupWorker } from 'msw/browser'
import { handlers } from '../src/test-utils/msw/handlers'

export const worker = setupWorker(...handlers)
