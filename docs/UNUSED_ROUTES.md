# Routes with no detected callers (issue #1490)

Scan: every `.route("…")` in `backend/src/api`, matched by its last path segment against
`frontend/src`, `indexer/src`, `mobile/src` and `tests`.

| Route | Callers found outside the backend |
|---|---|
| `/archives`, `/archives/{id}`, `/archives/{id}/restore` | none |
| `/export/send-email` | none |
| `/incentive/programmes`, `/programmes` | none |

These routes are **not removed**. The issue requires owner sign-off first, and some may have
external consumers. Before removal: confirm with the owners, deprecate in `CHANGELOG.md`, then
delete the handlers and their route registrations together.

Routes that do have callers are not listed here.
