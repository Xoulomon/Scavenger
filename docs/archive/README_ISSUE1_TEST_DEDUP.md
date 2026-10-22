# Issue 1: De-duplicate integration tests in `backend/tests/api`

## What was found

`backend/tests/api/export_tests.rs` contained several tests that exercised
plain struct/enum/serde behavior with no HTTP router, middleware, or
`AppState` involved:

- `test_export_waste_csv` — placeholder test, only asserted `true` in every
  match arm. No real coverage.
- `test_export_format_validation` — iterated a hardcoded list of valid
  formats and asserted `true`; the "invalid_formats" vector was unused.
  Dead assertion, no real coverage.
- `test_export_response_format` — checked that a manually constructed
  `ExportResponse` serializes with the expected top-level keys. This is a
  `serde::Serialize` derive check, not an integration concern.
- `test_export_format_serialization` / `test_export_format_deserialization`
  — round-tripped `ExportFormat` through `serde_json`. Also a pure
  unit-level serde check.

None of these tests spun up a router, called a handler function, or touched
`AppState`/database/cache — the things that actually make a test
"integration" rather than "unit." They duplicated coverage that belongs at
the unit level next to the `ExportFormat`/`ExportResponse` type
definitions, while paying the cost (setup, `#[tokio::test]` runtime,
slower CI) of an integration test.

## What changed

- Removed the placeholder and redundant serde-only tests.
- Kept a single wire-shape smoke test (`test_export_waste_json_wire_shape`)
  and consolidated the two serialize/deserialize tests into one
  round-trip test (`test_export_format_round_trip`), since both directions
  are meaningfully different from the removed handler test.
- File shrank from 99 lines / 6 tests to ~38 lines / 2 tests.

## Coverage regression check

The removed assertions (serde derive behavior for `ExportFormat` /
`ExportResponse`) are structurally guaranteed by `#[derive(Serialize,
Deserialize)]` and are exercised transitively by the remaining round-trip
test and by any handler-level test that touches these types. No unique
branch of application logic was only reachable through the removed tests
— they asserted properties of derived trait implementations, not of
`scavenger_backend` business logic. No coverage regression expected.
