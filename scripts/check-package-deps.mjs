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

const ALLOWED_DEPS = {
  '@scavenger/types': [],
  '@scavenger/shared': ['@scavenger/types'],
  '@scavenger/sdk': ['@scavenger/types', '@scavenger/shared'],
};

if (!existsSync(ROOT)) {
  console.error(`[check-package-deps] No "packages/" directory found at ${ROOT}`);
  process.exit(1);
}

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

for (const [name, info] of packages) {
  const allowed = ALLOWED_DEPS[name];
  if (!allowed) {
    errors.push(
      `Unknown package "${name}" (dir: ${info.dir}). ` +
        `Add it to ALLOWED_DEPS in scripts/check-package-deps.mjs.`
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

if (errors.length > 0) {
  console.error('[check-package-deps] Found issues:\n');
  for (const e of errors) console.error('  - ' + e);
  console.error('\nSee docs/PACKAGES_DEPENDENCY_GRAPH.md for the allowed rules.');
  process.exit(1);
}

console.log(
  `[check-package-deps] OK - checked ${packages.size} package(s), no violations.`
);
process.exit(0);
