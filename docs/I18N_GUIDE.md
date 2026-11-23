# i18n Process Guide

This document describes the internationalization (i18n) architecture, translation workflow, and contribution process for the Scavngr frontend.

## Supported Languages

| Code | Language | Direction |
| ---- | -------- | --------- |
| `en` | English  | LTR       |
| `es` | Español  | LTR       |
| `fr` | Français | LTR       |
| `zh` | 中文     | LTR       |
| `ar` | العربية  | RTL       |

## Architecture

The frontend uses [i18next](https://www.i18next.com/) with `react-i18next` bindings.

```
frontend/src/i18n/
├── config.ts                  # i18next init, RTL helpers
├── locales/
│   ├── en.json                # English (source of truth)
│   ├── es.json                # Spanish
│   ├── fr.json                # French
│   ├── zh.json                # Chinese (Simplified)
│   └── ar.json                # Arabic (RTL)
└── __tests__/
    └── i18n.test.ts           # Translation coverage tests
```

### Key Namespaces

All translations live in a single `translation` namespace, organized by domain:

| Namespace        | Description                        |
| ---------------- | ---------------------------------- |
| `common.*`       | Shared UI labels (Save, Cancel...) |
| `nav.*`          | Navigation items                   |
| `waste.*`        | Waste management strings           |
| `auth.*`         | Wallet connection strings          |
| `participants.*` | Participant roles and labels       |
| `rewards.*`      | Reward-related strings             |
| `profile.*`      | User profile strings               |
| `errors.*`       | Error messages                     |
| `settings.*`     | Settings page labels               |

## Usage in Components

### Basic translation

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()
  return <h1>{t('waste.title')}</h1>
}
```

### Language switching

Use the `LanguageSwitcher` component:

```tsx
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

function Header() {
  return (
    <header>
      <LanguageSwitcher />
    </header>
  )
}
```

### RTL layout support

Use the `useRTL` hook to conditionally apply RTL-aware styles:

```tsx
import { useRTL } from '@/hooks/useRTL'

function Sidebar() {
  const { dir } = useRTL()
  return <aside dir={dir}>...</aside>
}
```

The i18n config also automatically sets `document.documentElement.dir` on language change, so CSS logical properties (`margin-inline-start`, `padding-inline-end`, etc.) work without per-component logic.

## Adding a New Translation Key

1. **Add to `en.json`** (source of truth):

```json
{
  "section": {
    "myNewKey": "My English string"
  }
}
```

2. **Add to all other locale files** (`es.json`, `fr.json`, `zh.json`, `ar.json`) with the translated value.

3. **Add a test** in `__tests__/i18n.test.ts` verifying the English key resolves correctly.

4. Open a PR — CI will catch missing keys via TypeScript if you use the typed `t()` helper.

## Adding a New Language

1. Create `frontend/src/i18n/locales/<code>.json` with all existing keys translated.
2. Import and register it in `config.ts`:

```ts
import de from './locales/de.json'

const resources = {
  // ...existing
  de: { translation: de }
}
```

3. Add the language entry to `LANGUAGES` in `LanguageSwitcher.tsx`.
4. If the language is RTL, add its code to `RTL_LANGUAGES` in `config.ts`.

## Translation Testing

Run unit tests:

```bash
cd frontend
npm test -- --testPathPattern=i18n
```

Tests verify:

- All supported languages load without errors.
- Key translations return expected strings.
- RTL language detection works for Arabic.
- Language preference persists in localStorage.

## RTL Support Notes

- Arabic (`ar`) is the only RTL language currently supported.
- `document.documentElement.dir` is set automatically via the `languageChanged` event in `config.ts`.
- Use CSS logical properties for layouts that must flip in RTL (e.g., `margin-inline-start` instead of `margin-left`).
- Test RTL layouts by switching to Arabic in the UI.

## Translation Workflow for Contributors

1. Fork the repository.
2. Add or modify keys in `en.json` with your changes.
3. Update all other locale files with translated strings. If you don't speak a language, add a `TODO` comment or open the PR with only `en.json` updated and tag a native speaker for review.
4. Run `npm test` to ensure all translation tests pass.
5. Submit a PR targeting `main` — include the issue number in the title.
