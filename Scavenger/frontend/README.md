# ⚠️ DEPRECATED — This directory has been relocated

**This directory is no longer in use.** The `CONTRIBUTING.md` compliance tests have been moved to a clearer location to avoid confusion with the main frontend application.

## New Location

The contributing guidelines compliance tests are now at:
```
tests/contributing-guidelines/
```

See [tests/contributing-guidelines/README.md](../../tests/contributing-guidelines/README.md) for instructions.

## What was here

`Scavenger/frontend/` was a **standalone Vitest test fixture** that validated `CONTRIBUTING.md` completeness. It has been relocated to `tests/contributing-guidelines/` for better organization and to avoid being mistaken for a duplicate of the main frontend application.

## Where is the real frontend?

The canonical React frontend is at:
```
frontend/                    ← Real React app (60+ source files, Vite, Tailwind)
```

## Migration Guide

If you were running tests from here, update your workflow:

**Old command:**
```bash
cd Scavenger/frontend
npm install
npm test
```

**New command:**
```bash
cd tests/contributing-guidelines
npm install
npm test
```

See the [relocation documentation](../../CODE_QUALITY_ANALYSIS_1158_1161.md#1161-resolve-duplicate-frontend-directory) for details.
