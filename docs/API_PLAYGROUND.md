# API Playground

The Scavenger API Playground is an in-browser REST client for exploring and testing all backend endpoints without leaving the app.

## Accessing the Playground

Navigate to `/playground` in the Scavenger web app. No additional installation is required.

For local development:

```
http://localhost:3000/playground
```

The playground reads `VITE_API_BASE_URL` at build time. To target a different environment, set that variable before building:

```bash
VITE_API_BASE_URL=https://api.staging.scavenger.io npm run build
```

---

## Interface Overview

The playground is split into three areas:

| Area                | Description                                                                        |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Left panel**      | Toggle between _Examples_ (pre-built requests) and _History_ (past requests)       |
| **Request builder** | Method selector, URL bar, Send button, and tabs for Params / Headers / Body / Auth |
| **Response viewer** | Status, duration, response body (pretty-printed JSON), and response headers        |

---

## Building a Request

### 1. Method and URL

Select an HTTP method from the dropdown (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) and type or paste the endpoint path:

```
GET  /api/contracts/wastes
```

The base URL (`http://localhost:8080` or `VITE_API_BASE_URL`) is prepended automatically.

### 2. Query Parameters

Switch to the **Params** tab to add URL query parameters as key-value pairs. Enable or disable individual parameters using the checkbox. Enabled parameters are appended to the URL automatically.

Example:

| Key      | Value     | Enabled |
| -------- | --------- | ------- |
| `page`   | `1`       | ✅      |
| `limit`  | `20`      | ✅      |
| `status` | `pending` | ✅      |

### 3. Headers

Switch to the **Headers** tab to add or modify request headers. The `Accept: application/json` header is pre-populated for new requests.

Custom headers required by the backend:

| Header                           | When Required                                    |
| -------------------------------- | ------------------------------------------------ |
| `Content-Type: application/json` | POST / PUT / PATCH with JSON body                |
| `X-CSRF-Token: <token>`          | All mutating requests (POST, PUT, PATCH, DELETE) |
| `Authorization: Bearer <token>`  | Authenticated endpoints                          |

### 4. Request Body

Switch to the **Body** tab to write a JSON (or other format) request body. A warning is shown when a body is provided with `GET` or `DELETE`.

Example body for `/api/export`:

```json
{
  "format": "csv",
  "data_type": "wastes",
  "anonymize": false
}
```

### 5. Authentication

Switch to the **Auth** tab to configure credentials. The playground supports four modes:

| Mode                   | Effect                               |
| ---------------------- | ------------------------------------ |
| **None**               | No authentication header added       |
| **Bearer Token**       | Adds `Authorization: Bearer <token>` |
| **API Key**            | Adds `X-API-Key: <key>`              |
| **Stellar Public Key** | Adds `X-Stellar-Public-Key: <key>`   |

Credentials are stored only in component state — they are never persisted to `localStorage` or sent to any analytics service.

---

## Example Requests

The playground ships with six pre-built example requests covering common workflows. Select a category tab and click **Load** to populate the request builder.

| Category     | Example            | Description                               |
| ------------ | ------------------ | ----------------------------------------- |
| Contracts    | List Wastes        | Paginated list of waste records           |
| Contracts    | Get Contract Stats | Overall on-chain statistics               |
| Analytics    | Get Analytics      | Participant analytics with date filtering |
| Export       | Export CSV         | Export waste data as a CSV file           |
| Audit        | Get Audit Logs     | Retrieve paginated audit log entries      |
| Verification | Verify Record      | Submit a record for verification          |

---

## Request History

Every request you send is stored in the **History** panel for the current session. Click any entry to reload that request and its response into the builder and viewer.

History is stored in React state only — it is cleared when the page is refreshed.

Use cases:

- Replay a request with modified parameters
- Compare responses across different environments
- Debug intermittent failures by replaying exact request payloads

---

## Response Visualization

| Field        | Description                                                                   |
| ------------ | ----------------------------------------------------------------------------- |
| Status badge | HTTP status code with colour coding (green = 2xx, amber = 3xx/4xx, red = 5xx) |
| Duration     | Round-trip time in milliseconds                                               |
| Timestamp    | Local time when the response was received                                     |
| Body         | JSON responses are pretty-printed automatically; other formats shown verbatim |
| Headers      | Full response header table                                                    |
| Copy button  | Copies the pretty-printed body to the clipboard                               |

---

## Error Responses

All errors from the Scavenger backend follow the unified error format:

```json
{
  "error": {
    "code": "validation.field_error",
    "message": "Field 'email': required",
    "status": 422,
    "category": "validation",
    "fields": [{ "field": "email", "message": "required" }]
  }
}
```

See [Error Codes Reference](./ERROR_CODES.md) for the full list of codes.

---

## Common Workflows

### Register a Participant

```
POST /api/contracts/participants
Content-Type: application/json
X-CSRF-Token: <token>

{
  "name": "EcoRecyclers Ltd",
  "role": "recycler",
  "location": "Lagos, NG"
}
```

### Submit and Confirm a Waste Record

```
POST /api/contracts/wastes
Content-Type: application/json

{
  "waste_type": "plastic",
  "weight": 5000,
  "location": "6.5244,3.3792"
}
```

Then confirm:

```
POST /api/contracts/wastes/{id}/confirm
X-CSRF-Token: <token>
```

### Export Audit Data as JSON

```
POST /api/export
Content-Type: application/json

{
  "format": "json",
  "data_type": "audit_logs",
  "anonymize": true
}
```

---

## Rate Limits

The backend enforces the following limits. The playground respects them:

| Tier    | Limit                 |
| ------- | --------------------- |
| Default | 100 requests / minute |
| Burst   | 10 requests / second  |

When the rate limit is exceeded you will see:

```json
{ "error": { "code": "rate_limit.exceeded", "status": 429, ... } }
```

Wait for the `X-RateLimit-Reset` response header timestamp before retrying.

---

## Keyboard Shortcuts

| Shortcut                       | Action                                                |
| ------------------------------ | ----------------------------------------------------- |
| `Ctrl + Enter` / `Cmd + Enter` | Send the current request                              |
| `Ctrl + L`                     | Focus the URL bar                                     |
| `Escape`                       | Cancel an in-flight request (if supported by browser) |

---

## Source Files

| File                                                        | Purpose                            |
| ----------------------------------------------------------- | ---------------------------------- |
| `frontend/src/components/ApiPlayground/index.tsx`           | Root component, fetch logic, state |
| `frontend/src/components/ApiPlayground/RequestBuilder.tsx`  | Method/URL bar, tabs, KV editor    |
| `frontend/src/components/ApiPlayground/ResponseViewer.tsx`  | Status, body, headers display      |
| `frontend/src/components/ApiPlayground/AuthConfig.tsx`      | Auth mode selector                 |
| `frontend/src/components/ApiPlayground/RequestHistory.tsx`  | Session history list               |
| `frontend/src/components/ApiPlayground/ExampleRequests.tsx` | Pre-built request catalog          |
| `frontend/src/components/ApiPlayground/types.ts`            | Shared TypeScript interfaces       |
| `frontend/src/pages/ApiPlaygroundPage.tsx`                  | Route-level page wrapper           |
