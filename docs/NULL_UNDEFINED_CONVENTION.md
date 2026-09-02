# Null / Undefined Convention

This document defines the repo-wide convention for `null` vs `undefined` in
TypeScript code. Consistent use eliminates a whole class of subtle bugs at
call sites and keeps type signatures easier to read.

## The Rule

| Value | Use when |
|-------|----------|
| `undefined` | A value is **absent** — optional, not yet provided, not yet loaded, or a function has no meaningful result to return |
| `null` | A value was **explicitly set to nothing** by an API response, a contract call, or by the user deliberately clearing a field |

## Rationale

- `undefined` is JavaScript's native "not present" signal. It is what optional
  function parameters, unset object properties, and missing array elements
  naturally produce.
- `null` should be a deliberate data value — it means "we asked, and the
  answer is nothing".
- Mixing the two forces callers to write `x == null` guards everywhere or
  risk subtle `undefined !== null` bugs.

## Scope

This convention applies to:
- All utilities in `frontend/src/lib/`
- All utilities in `packages/shared/src/`
- All types in `packages/types/src/`

Code that wraps **external APIs** (Stellar RPC, Firebase, browser APIs) may
preserve `null` values that those APIs return, but must document this in the
function signature or a comment.

## ESLint enforcement

The `no-restricted-syntax` rule is configured in `frontend/eslint.config.js`
to warn when a utility function inside `src/lib/` returns the literal `null`
instead of `undefined`. See `eslint.config.js` for the rule definition.

## Examples

```ts
// ✅ Correct — function returns undefined for "not found"
function findUser(id: string): User | undefined {
  return users.find(u => u.id === id)
}

// ✅ Correct — API wrapper preserves null from the backend
async function getParticipant(address: string): Promise<Participant | null> {
  // The REST API returns null when a participant is not registered
  return api.get<Participant | null>(`/participants/${address}`)
}

// ❌ Incorrect — utility function returns null for absent value
function parseWeight(value: string): number | null {
  const n = parseFloat(value)
  return isNaN(n) ? null : n // should be undefined
}

// ✅ Fixed
function parseWeight(value: string): number | undefined {
  const n = parseFloat(value)
  return isNaN(n) ? undefined : n
}
```
