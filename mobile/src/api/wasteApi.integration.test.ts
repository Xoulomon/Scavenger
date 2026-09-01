/**
 * Integration tests for mobile/src/api layer
 *
 * These tests verify that the mobile app correctly communicates with the
 * backend API for key flows: submit waste, get waste, transfer waste, and
 * get participant stats.
 *
 * ## How to run
 *
 * ```bash
 * cd mobile
 * npm test -- --testPathPattern="src/api/wasteApi.integration"
 * ```
 *
 * Or run all tests:
 * ```bash
 * cd mobile
 * npm test
 * ```
 *
 * ## How the mock server works
 *
 * We use [MSW (Mock Service Worker)](https://mswjs.io/) v2 with the
 * `@mswjs/interceptors` Node.js adapter to intercept `axios` requests at the
 * HTTP-adapter level — no real network calls are made.
 *
 * The `server` is started once before all tests (`beforeAll`), reset to the
 * default handler set between tests (`afterEach`), and stopped after the
 * suite (`afterAll`).  Individual tests that need error scenarios use
 * `server.use(...)` to add one-time override handlers.
 *
 * ## Coverage targets
 *
 * This suite targets ≥ 80 % statement/branch coverage on `mobile/src/api/wasteApi.ts`.
 * Covered flows:
 *  - submitWaste    — success, 4xx client error, 5xx server error
 *  - getWaste       — success, 404 not found, network timeout
 *  - transferWaste  — success, 403 forbidden
 *  - getParticipantStats — success, 404 unknown participant
 */

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  submitWaste,
  getWaste,
  transferWaste,
  getParticipantStats,
  WasteSubmission,
} from './wasteApi';

// ── MSW server setup ──────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:8080';

/** Default happy-path handlers — overridden per-test where needed. */
const defaultHandlers = [
  // POST /api/waste/submit
  http.post(`${BASE_URL}/api/waste/submit`, async ({ request }) => {
    const body = await request.json() as WasteSubmission;
    return HttpResponse.json({
      waste_id: 'waste-001',
      waste_type: body.waste_type,
      weight: body.weight,
      submitter: body.submitter,
      status: 'pending',
    });
  }),

  // GET /api/waste/:id
  http.get(`${BASE_URL}/api/waste/:id`, ({ params }) => {
    const { id } = params as { id: string };
    return HttpResponse.json({
      waste_id: id,
      waste_type: 'Plastic',
      weight: 5.2,
      status: 'pending',
    });
  }),

  // POST /api/waste/:id/transfer
  http.post(`${BASE_URL}/api/waste/:id/transfer`, async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = await request.json() as { to: string };
    return HttpResponse.json({
      waste_id: id,
      transferred_to: body.to,
      status: 'transferred',
    });
  }),

  // GET /api/participants/:address/stats
  http.get(`${BASE_URL}/api/participants/:address/stats`, ({ params }) => {
    const { address } = params as { address: string };
    return HttpResponse.json({
      address,
      total_waste: 124.5,
      total_rewards: 250,
    });
  }),
];

const server = setupServer(...defaultHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── submitWaste ───────────────────────────────────────────────────────────────

describe('submitWaste', () => {
  const validSubmission: WasteSubmission = {
    waste_type: 'Plastic',
    weight: 5.2,
    submitter: 'GDUMMYADDRESS123',
  };

  it('should submit waste and return the created waste record', async () => {
    const result = await submitWaste(validSubmission);

    expect(result).toMatchObject({
      waste_id: 'waste-001',
      waste_type: 'Plastic',
      weight: 5.2,
      submitter: 'GDUMMYADDRESS123',
      status: 'pending',
    });
  });

  it('should send all required fields in the request body', async () => {
    let capturedBody: unknown;

    server.use(
      http.post(`${BASE_URL}/api/waste/submit`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ waste_id: 'captured' });
      })
    );

    await submitWaste(validSubmission);

    expect(capturedBody).toEqual({
      waste_type: 'Plastic',
      weight: 5.2,
      submitter: 'GDUMMYADDRESS123',
    });
  });

  it('should propagate a 400 Bad Request error', async () => {
    server.use(
      http.post(`${BASE_URL}/api/waste/submit`, () =>
        HttpResponse.json(
          { error: 'Invalid waste type' },
          { status: 400 }
        )
      )
    );

    await expect(submitWaste(validSubmission)).rejects.toThrow();
  });

  it('should propagate a 500 Internal Server Error', async () => {
    server.use(
      http.post(`${BASE_URL}/api/waste/submit`, () =>
        HttpResponse.json(
          { error: 'Internal error' },
          { status: 500 }
        )
      )
    );

    await expect(submitWaste(validSubmission)).rejects.toThrow();
  });
});

// ── getWaste ──────────────────────────────────────────────────────────────────

describe('getWaste', () => {
  it('should retrieve waste details by id', async () => {
    const result = await getWaste('waste-001');

    expect(result).toMatchObject({
      waste_id: 'waste-001',
      waste_type: 'Plastic',
      weight: 5.2,
      status: 'pending',
    });
  });

  it('should pass the waste id in the URL path', async () => {
    let capturedId: string | undefined;

    server.use(
      http.get(`${BASE_URL}/api/waste/:id`, ({ params }) => {
        capturedId = (params as { id: string }).id;
        return HttpResponse.json({ waste_id: capturedId, waste_type: 'Metal', weight: 1 });
      })
    );

    await getWaste('waste-xyz-789');
    expect(capturedId).toBe('waste-xyz-789');
  });

  it('should propagate a 404 Not Found error', async () => {
    server.use(
      http.get(`${BASE_URL}/api/waste/:id`, () =>
        HttpResponse.json({ error: 'Not found' }, { status: 404 })
      )
    );

    await expect(getWaste('nonexistent')).rejects.toThrow();
  });

  it('should propagate a network timeout (axios error)', async () => {
    server.use(
      http.get(`${BASE_URL}/api/waste/:id`, () =>
        HttpResponse.error()
      )
    );

    await expect(getWaste('timeout-id')).rejects.toThrow();
  });
});

// ── transferWaste ─────────────────────────────────────────────────────────────

describe('transferWaste', () => {
  it('should transfer waste to another participant', async () => {
    const result = await transferWaste('waste-001', 'GRECIPIENT456');

    expect(result).toMatchObject({
      waste_id: 'waste-001',
      transferred_to: 'GRECIPIENT456',
      status: 'transferred',
    });
  });

  it('should include the recipient address in the request body', async () => {
    let capturedBody: unknown;

    server.use(
      http.post(`${BASE_URL}/api/waste/:id/transfer`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ transferred: true });
      })
    );

    await transferWaste('waste-001', 'GNEWOWNER789');
    expect(capturedBody).toEqual({ to: 'GNEWOWNER789' });
  });

  it('should include the waste id in the URL path', async () => {
    let capturedId: string | undefined;

    server.use(
      http.post(`${BASE_URL}/api/waste/:id/transfer`, ({ params }) => {
        capturedId = (params as { id: string }).id;
        return HttpResponse.json({ ok: true });
      })
    );

    await transferWaste('waste-abc', 'GRECIPIENT');
    expect(capturedId).toBe('waste-abc');
  });

  it('should propagate a 403 Forbidden error', async () => {
    server.use(
      http.post(`${BASE_URL}/api/waste/:id/transfer`, () =>
        HttpResponse.json(
          { error: 'You do not own this waste' },
          { status: 403 }
        )
      )
    );

    await expect(transferWaste('waste-001', 'GBADACTOR')).rejects.toThrow();
  });

  it('should propagate a 404 when waste does not exist', async () => {
    server.use(
      http.post(`${BASE_URL}/api/waste/:id/transfer`, () =>
        HttpResponse.json({ error: 'Not found' }, { status: 404 })
      )
    );

    await expect(transferWaste('ghost', 'GRECIPIENT')).rejects.toThrow();
  });
});

// ── getParticipantStats ───────────────────────────────────────────────────────

describe('getParticipantStats', () => {
  it('should retrieve stats for a known participant', async () => {
    const result = await getParticipantStats('GPARTICIPANT123');

    expect(result).toMatchObject({
      address: 'GPARTICIPANT123',
      total_waste: 124.5,
      total_rewards: 250,
    });
  });

  it('should pass the address in the URL path', async () => {
    let capturedAddress: string | undefined;

    server.use(
      http.get(`${BASE_URL}/api/participants/:address/stats`, ({ params }) => {
        capturedAddress = (params as { address: string }).address;
        return HttpResponse.json({ address: capturedAddress, total_waste: 0, total_rewards: 0 });
      })
    );

    await getParticipantStats('GTEST_ADDR_987');
    expect(capturedAddress).toBe('GTEST_ADDR_987');
  });

  it('should propagate a 404 for an unknown participant', async () => {
    server.use(
      http.get(`${BASE_URL}/api/participants/:address/stats`, () =>
        HttpResponse.json({ error: 'Participant not found' }, { status: 404 })
      )
    );

    await expect(getParticipantStats('GNOTREGISTERED')).rejects.toThrow();
  });

  it('should propagate a 500 server error', async () => {
    server.use(
      http.get(`${BASE_URL}/api/participants/:address/stats`, () =>
        HttpResponse.json({ error: 'Database offline' }, { status: 500 })
      )
    );

    await expect(getParticipantStats('GANY')).rejects.toThrow();
  });
});

// ── Cross-cutting: HTTP method and content-type ────────────────────────────────

describe('API client configuration', () => {
  it('submitWaste sends Content-Type: application/json', async () => {
    let capturedContentType: string | null = null;

    server.use(
      http.post(`${BASE_URL}/api/waste/submit`, ({ request }) => {
        capturedContentType = request.headers.get('Content-Type');
        return HttpResponse.json({ waste_id: 'x' });
      })
    );

    await submitWaste({ waste_type: 'Glass', weight: 1.0, submitter: 'G123' });
    expect(capturedContentType).toMatch(/application\/json/);
  });

  it('getWaste uses GET method', async () => {
    let capturedMethod: string | null = null;

    server.use(
      http.get(`${BASE_URL}/api/waste/:id`, ({ request }) => {
        capturedMethod = request.method;
        return HttpResponse.json({ waste_id: 'y', waste_type: 'Paper', weight: 0.5 });
      })
    );

    await getWaste('any-id');
    expect(capturedMethod).toBe('GET');
  });
});
