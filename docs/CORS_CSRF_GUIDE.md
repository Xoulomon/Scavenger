# CORS and CSRF Protection

## CORS Policy

Cross-Origin Resource Sharing (CORS) is configured in `backend/src/main.rs`.

**Allowed origins** are read from the `ALLOWED_ORIGINS` environment variable (comma-separated). Default: `http://localhost:3000`.

**Allowed methods:** `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

**Allowed headers:** `Authorization`, `Content-Type`, `X-CSRF-Token`, `X-Session-Id`

**Max age:** 3600 seconds (preflight cache)

To add a production origin:

```
ALLOWED_ORIGINS=https://app.scavngr.io,https://staging.scavngr.io
```

## CSRF Protection

The `CsrfMiddleware` in `backend/src/middleware/csrf.rs` protects all state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).

### How it works

1. The server generates a token: `generate_token(session_id, secret)` → HMAC-like hex string
2. The client includes the token in every state-changing request via `X-CSRF-Token`
3. The server validates the token before processing the request

### Client integration

```js
// 1. Obtain token from server (e.g. /api/v1/auth/csrf-token)
const token = await getCsrfToken()

// 2. Include in requests
fetch('/api/v1/contracts/wastes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
    'X-Session-Id': sessionId
  },
  body: JSON.stringify(payload)
})
```

### Environment variables

| Variable          | Default                   | Description                                                     |
| ----------------- | ------------------------- | --------------------------------------------------------------- |
| `CSRF_SECRET`     | `change-me-in-production` | Secret used to sign CSRF tokens — **must be set in production** |
| `ALLOWED_ORIGINS` | `http://localhost:3000`   | Comma-separated allowed CORS origins                            |
