# Issue 3: Strict startup config validation

## What changed

`backend/src/config/app.rs` — `AppConfig::validate()` previously only
checked that `CSRF_SECRET` wasn't left at its insecure default. Extended it
to fail fast on every environment-derived field:

- **`LOG_FORMAT`**: must be `"json"` or `"pretty"` (case-insensitive).
  Anything else is now a startup error instead of silently falling through
  to non-JSON logging in what might be a JSON-log-expecting environment.
- **`ALLOWED_ORIGINS`**: must be non-empty, must not contain empty entries
  from stray commas, and every entry must start with `http://` or
  `https://`. Previously a typo'd or empty origin list would silently
  produce a CORS policy that either allows nothing or fails confusingly at
  request time instead of at startup.
- **`REDIS_URL`**: when set, must start with `redis://` or `rediss://`.
  Previously a malformed Redis URL would only surface as a connection
  failure deep in the cache layer instead of a clear startup error.

`validate()` remains the single fail-fast gate intended to be called from
`main()` before the server starts accepting traffic — any `Err` should
abort startup with the returned message.

## Tests added

Added to the existing `#[cfg(test)] mod tests` in `app.rs`:

- `test_validate_rejects_invalid_log_format`
- `test_validate_rejects_empty_allowed_origins`
- `test_validate_rejects_malformed_origin`
- `test_validate_accepts_multiple_valid_origins`
- `test_validate_rejects_malformed_redis_url`
- `test_validate_accepts_well_formed_redis_url`

These cover both the "missing" (empty `ALLOWED_ORIGINS`) and "malformed"
(bad `LOG_FORMAT`, non-URL origin, non-`redis://` URL) scenarios called out
in the issue, alongside the existing `CSRF_SECRET` coverage.
