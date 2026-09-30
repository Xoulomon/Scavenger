# eslint-rules/

Custom ESLint rules for the Scavenger monorepo.

## Audit — Issue #1312

**Date:** 2026-09-30  
**Finding:** No unused rules. All rules in this directory are actively referenced.

| Rule file | Rule name | Referenced in |
| :--- | :--- | :--- |
| `error-message-format.js` | `error-message-format/error-message-format` | `indexer/eslint.config.js`, `frontend/eslint.config.js` |

No rules were removed.

---

## Rules

### `error-message-format`

**File:** `error-message-format.js`  
**Type:** suggestion (auto-fixable)  
**Severity:** `error` in all referencing configs

Enforces a consistent format for `new Error(…)` and `new AppError(…)` message strings:

1. Message must start with a capital letter.
2. Message must end with a period (`.`).
3. Messages shorter than 30 characters that match vague patterns (`error`, `something went wrong`, `unexpected`) are flagged as too vague.

#### Example violations

```ts
// ❌ lowercase first letter
throw new Error('something failed')

// ❌ missing trailing period
throw new Error('Something failed')

// ❌ vague and short
throw new Error('error')
```

#### Correct usage

```ts
// ✅
throw new Error('Something failed while submitting the material.')

// ✅
throw new AppError('Participant address is not registered on-chain.')
```

#### Adding new rules

1. Create a new `.js` file in this directory following the ESLint rule module format.
2. Register it in the `plugins` object of `indexer/eslint.config.js` and/or `frontend/eslint.config.js`.
3. Update the audit table in this README.
