# Packages Dependency Graph

This document describes the dependency structure of the `packages/` monorepo
workspace. It exists to prevent accidental circular dependencies and to make
the **allowed dependency direction** explicit for contributors.

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@scavenger/types` | `packages/types/` | Shared TypeScript types (no runtime deps, no internal deps) |
| `@scavenger/shared` | `packages/shared/` | Shared runtime utilities (may depend on `types`) |
| `@scavenger/sdk` | `packages/scavenger-sdk/` | Client SDK (may depend on `types` and `shared`) |

> Names above reflect intent. If a package is added or renamed, update this
> table and the allowed-direction matrix below.

## Allowed Dependency Direction

Dependencies flow **downward only**:


| From ↓ / To → | types | shared | scavenger-sdk |
|---------------|:-----:|:------:|:-------------:|
| **types**         |  —  | ❌ | ❌ |
| **shared**        | ✅  | —  | ❌ |
| **scavenger-sdk** | ✅  | ✅ | —  |

**Legend**
- ✅ allowed
- ❌ forbidden (would create a cycle or invert the dependency direction)
- — self

### Rules

1. `types` **must not** import from any other package in `packages/`.
2. `shared` **may** import from `types` only.
3. `scavenger-sdk` **may** import from `types` and `shared`.
4. Any reverse edge (e.g. `types` → `shared`) is a **violation** and CI must reject it.
5. Cycles of any length are forbidden.

## Generating the graph locally

If you have [pnpm](https://pnpm.io/) installed:

```bash
# List workspace packages
pnpm -r list --depth -1

# Show the workspace dependency tree
pnpm list -r --depth 5
npx dependency-cruiser --include-only "^packages/" --output-type dot packages \
  | dot -T svg > docs/packages-dependency-graph.svg
node scripts/check-package-deps.mjs

---

## 📋 Step 3: Create the Guard Script

```bash
mkdir -p scripts

cat > scripts/check-package-deps.mjs << 'EOF'
#!/usr/bin/env node
/**
 * Guard script: validate the dependency direction between packages/* in this
 * monorepo. Fails (exit 1) if a package depends on another package that is
 * not allowed by the rules in docs/PACKAGES_DEPENDENCY_GRAPH.md.
 *
 * Rules:
 *   types          -> (nothing)
 *   shared         -> types
 *   scavenger-sdk  -> types, shared
 *
 * Any cycle is a violation.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'packages');

/** Allowed outgoing deps per package name. Extend when adding new packages. */
const ALLOWED_DEPS = {
  '@scavenger/types': [],
  '@scavenger/shared': ['@scavenger/types'],
  '@scavenger/sdk': ['@scavenger/types', '@scavenger/shared'],
};

if (!existsSync(ROOT)) {
  console.error(`[check-package-deps] No "packages/" directory found at ${ROOT}`);
  process.exit(1);
}

/** Load every package's name + declared internal deps. */
function loadPackages() {
  const result = new Map();
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgJsonPath = join(ROOT, entry.name, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;

    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    const internal = Object.keys(deps).filter((name) => name.startsWith('@scavenger/'));
    result.set(pkg.name, { dir: entry.name, internal });
  }
  return result;
}

const packages = loadPackages();
const errors = [];

// 1. Allowed-direction check
for (const [name, info] of packages) {
  const allowed = ALLOWED_DEPS[name];
  if (!allowed) {
    errors.push(
      `Unknown package "${name}" (dir: ${info.dir}). ` +
        `Add it to ALLOWED_DEPS in scripts/check-package-deps.mjs and to ` +
        `docs/PACKAGES_DEPENDENCY_GRAPH.md.`
    );
    continue;
  }
  for (const dep of info.internal) {
    if (!allowed.includes(dep)) {
      errors.push(
        `Illegal dependency: "${name}" -> "${dep}". ` +
          `Allowed for ${name}: [${allowed.join(', ') || 'none'}].`
      );
    }
  }
}

// 2. Cycle check (DFS on the internal-dep graph)
const visited = new Set();
const stack = new Set();

function dfs(node, path) {
  if (stack.has(node)) {
    const cycle = [...path.slice(path.indexOf(node)), node].join(' -> ');
    errors.push(`Dependency cycle detected: ${cycle}`);
    return;
  }
  if (visited.has(node)) return;

  stack.add(node);
  const info = packages.get(node);
  if (info) {
    for (const dep of info.internal) {
      if (packages.has(dep)) dfs(dep, [...path, node]);
    }
  }
  stack.delete(node);
  visited.add(node);
}

for (const name of packages.keys()) dfs(name, []);

// Report
if (errors.length > 0) {
  console.error('[check-package-deps] ✗ Found issues:\n');
  for (const e of errors) console.error('  • ' + e);
  console.error('');
  console.error('See docs/PACKAGES_DEPENDENCY_GRAPH.md for the allowed rules.');
  process.exit(1);
}

console.log(
  `[check-package-deps] ✓ OK — checked ${packages.size} package(s), no violations.`
);
process.exit(0);
