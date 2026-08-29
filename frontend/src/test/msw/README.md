# MSW (Mock Service Worker) Test Infrastructure

## What is MSW?

MSW intercepts network requests at the service worker level during tests. Instead
of mocking `fetch` or `window.fetch` ad-hoc, MSW provides a centralized, declarative
layer that mirrors actual backend API response shapes.

## Architecture

```
frontend/src/test/msw/
  handlers.ts   — request handlers (mirrors backend API contracts)
  server.ts     — MSW server setup for Vitest (Node.js)
  README.md     — this file
```

## How It Works

1. `server.ts` creates an MSW server with the default handlers
2. The global test setup (`src/test/setup.tsx`) starts/stops the server
3. Tests that make HTTP requests get intercepted automatically
4. Per-test overrides use `server.use()`

## Lifecycle

```typescript
// In your test file — no setup needed, it's in setup.tsx:
import { server } from '@/test/msw/server'
import { http, HttpResponse } from 'msw'

// Override a handler for ONE test:
it('handles empty wastes', async () => {
  server.use(
    http.get('/api/wastes', () =>
      HttpResponse.json({ wastes: [], total: 0, limit: 100, offset: 0 })
    )
  )
  // ... test code
})
```

The global setup in `setup.tsx` handles:
- `beforeAll` → `server.listen()`
- `afterEach` → `server.resetHandlers()` (clears per-test overrides)
- `afterAll` → `server.close()`

## Adding a Handler

1. Inspect the backend endpoint response shape
2. Add a handler in `handlers.ts`:
   ```typescript
   http.get('*/api/new-endpoint', () => {
     return HttpResponse.json({ data: 'realistic fixture' })
   })
   ```
3. Use realistic data that matches the actual backend contract

## Simulating Errors

```typescript
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'

// 404 error
server.use(
  http.get('/api/wastes/:id', () =>
    HttpResponse.json({ error: 'Not found' }, { status: 404 })
  )
)

// 500 server error
server.use(
  http.get('/api/wastes', () =>
    HttpResponse.json({ error: 'Internal error' }, { status: 500 })
  )
)

// Network failure
server.use(
  http.get('/api/wastes', () => HttpResponse.error())
)
```

## Avoiding State Leaks

- `server.resetHandlers()` runs after EVERY test (in setup.tsx)
- Per-test overrides via `server.use()` are automatically cleared
- Default handlers remain active across all tests
- No test can leak handler overrides into another test

## API Response Shapes

Handlers mirror the actual backend responses:

| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| `/api/wastes` | GET | `{ wastes: Waste[], total, limit, offset }` |
| `/api/wastes/:id` | GET | `Waste` |
| `/api/wastes` | POST | `Waste` (201) |
| `/api/participants` | GET | `{ participants: Participant[], total, limit, offset }` |
| `/api/participants/:address` | GET | `Participant` |
| `/api/participants` | POST | `Participant` (201) |
| `/api/incentives` | GET | `{ incentives: Incentive[], total }` |
| `/api/incentives` | POST | `Incentive` (201) |
| `/api/stats/:address` | GET | `ParticipantStats` |
| `/api/metrics` | GET | `GlobalMetrics` |
| `/api/health` | GET | `{ status, uptime }` |

## When NOT to Use MSW

- **React context mocking** — use `vi.mock()` for context providers
- **Firebase/Firestore** — use `vi.mock()` (not HTTP-based)
- **Third-party SDK mocking** (Freighter, Leaflet) — use `vi.mock()`
- **Non-HTTP logic** — MSW only intercepts network requests
