#!/usr/bin/env node
/**
 * check-env-parity.mjs
 *
 * Enforces environment variable parity between code usage and the
 * `.env.example` files documented for each package.
 *
 *   - frontend/src  -> VITE_* references (import.meta.env.VITE_X, process.env.VITE_X)
 *                      compared against frontend/.env.example
 *   - indexer/src   -> process.env.X references
 *                      compared against indexer/.env.example
 *   - root          -> variables referenced by root-level tooling/scripts
 *                      compared against .env.example
 *
 * Exits non-zero when there is drift (missing or unused entries).
 *
 * Usage:
 *   node scripts/check-env-parity.mjs
 *   node scripts/check-env-parity.mjs --json
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const JSON_OUTPUT = process.argv.includes('--json');

/**
 * Allowlist for variables that are intentionally present in an example file
 * but not directly referenced in the scanned source (e.g. externally provided
 * by the platform, consumed by tooling outside the scanned directories, or
 * documented for operators).
 *
 * Keyed by the example file path (relative to repo root).
 */
const ALLOWLIST = {
  '.env.example': new Set([
    // Provided by the deployment platform / CI, not referenced in root code.
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'REDIS_URL',
    'LOG_LEVEL',
  ]),
  'frontend/.env.example': new Set([
    // Injected at build time by the hosting platform.
    'VITE_APP_VERSION',
  ]),
  'indexer/.env.example': new Set([
    // Provided by the runtime environment.
    'NODE_ENV',
    'LOG_LEVEL',
  ]),
};

/**
 * Variables that are referenced in code but intentionally not documented in
 * the example file (e.g. optional overrides with safe defaults).
 * Keyed by example file path.
 */
const CODE_ALLOWLIST = {
  '.env.example': new Set([]),
  'frontend/.env.example': new Set([]),
  'indexer/.env.example': new Set([]),
};

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.vue',
  '.svelte',
]);

/** Recursively collect source files under `dir`. */
function collectSourceFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;

  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'build' || entry === '.git') {
        continue;
      }
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        const dot = entry.lastIndexOf('.');
        const ext = dot >= 0 ? entry.slice(dot) : '';
        if (SOURCE_EXTENSIONS.has(ext)) {
          files.push(full);
        }
      }
    }
  };

  walk(dir);
  return files;
}

/** Extract VITE_* references from frontend source. */
function extractViteRefs(files) {
  const refs = new Map(); // name -> Set<relative file>
  const patterns = [
    /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g,
    /import\.meta\.env\[\s*['"`](VITE_[A-Z0-9_]+)['"`]\s*\]/g,
    /process\.env\.(VITE_[A-Z0-9_]+)/g,
    /process\.env\[\s*['"`](VITE_[A-Z0-9_]+)['"`]\s*\]/g,
  ];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        if (!refs.has(name)) refs.set(name, new Set());
        refs.get(name).add(rel);
      }
    }
  }

  return refs;
}

/** Extract process.env.X references from indexer (or any) source. */
function extractProcessEnvRefs(files) {
  const refs = new Map();
  const patterns = [
    /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
    /process\.env\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\]/g,
  ];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        if (!refs.has(name)) refs.set(name, new Set());
        refs.get(name).add(rel);
      }
    }
  }

  return refs;
}

/** Parse keys from a .env.example file, ignoring comments and blank lines. */
function parseEnvExample(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  const content = readFileSync(filePath, 'utf8');
  const keys = new Set();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    // Support optional `export ` prefix.
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const eq = normalized.indexOf('=');
    const key = (eq >= 0 ? normalized.slice(0, eq) : normalized).trim();
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Compare a set of code references against an example file's keys.
 * Returns { missing, unused }.
 */
function compare(refs, exampleKeys, exampleRelPath) {
  const allowUnused = ALLOWLIST[exampleRelPath] ?? new Set();
  const allowMissing = CODE_ALLOWLIST[exampleRelPath] ?? new Set();

  const missing = [];
  for (const name of refs.keys()) {
    if (!exampleKeys.has(name) && !allowMissing.has(name)) {
      missing.push(name);
    }
  }

  const unused = [];
  for (const name of exampleKeys) {
    if (!refs.has(name) && !allowUnused.has(name)) {
      unused.push(name);
    }
  }

  missing.sort();
  unused.sort();
  return { missing, unused };
}

function formatRefs(refs, names) {
  return names.map((name) => {
    const files = refs.get(name);
    const where = files && files.size ? ` (${[...files].sort().join(', ')})` : '';
    return `    - ${name}${where}`;
  });
}

function main() {
  const targets = [
    {
      label: 'frontend',
      exampleRel: 'frontend/.env.example',
      srcDir: join(ROOT, 'frontend', 'src'),
      extract: extractViteRefs,
    },
    {
      label: 'indexer',
      exampleRel: 'indexer/.env.example',
      srcDir: join(ROOT, 'indexer', 'src'),
      extract: extractProcessEnvRefs,
    },
    {
      label: 'root',
      exampleRel: '.env.example',
      srcDir: join(ROOT, 'scripts'),
      extract: extractProcessEnvRefs,
    },
  ];

  const results = [];
  let hasDrift = false;
  let hasError = false;

  for (const target of targets) {
    const examplePath = join(ROOT, target.exampleRel);
    const exampleKeys = parseEnvExample(examplePath);

    if (exampleKeys === null) {
      results.push({
        label: target.label,
        exampleRel: target.exampleRel,
        error: `Missing example file: ${target.exampleRel}`,
      });
      hasError = true;
      continue;
    }

    const files = collectSourceFiles(target.srcDir);
    const refs = target.extract(files);
    const { missing, unused } = compare(refs, exampleKeys, target.exampleRel);

    if (missing.length || unused.length) hasDrift = true;

    results.push({
      label: target.label,
      exampleRel: target.exampleRel,
      scannedFiles: files.length,
      referenced: refs.size,
      documented: exampleKeys.size,
      missing,
      unused,
      missingDetails: formatRefs(refs, missing),
    });
  }

  if (JSON_OUTPUT) {
    const payload = {
      ok: !hasDrift && !hasError,
      results: results.map((r) => ({
        label: r.label,
        exampleRel: r.exampleRel,
        error: r.error,
        scannedFiles: r.scannedFiles,
        referenced: r.referenced,
        documented: r.documented,
        missing: r.missing,
        unused: r.unused,
      })),
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(hasDrift || hasError ? 1 : 0);
  }

  console.log('Environment variable parity check\n');

  for (const r of results) {
    console.log(`[${r.label}] ${r.exampleRel}`);
    if (r.error) {
      console.log(`  ERROR: ${r.error}\n`);
      continue;
    }
    console.log(
      `  scanned ${r.scannedFiles} file(s); ${r.referenced} referenced, ${r.documented} documented`,
    );

    if (r.missing.length === 0 && r.unused.length === 0) {
      console.log('  OK: no drift\n');
      continue;
    }

    if (r.missing.length) {
      console.log(`  MISSING from ${r.exampleRel} (referenced in code):`);
      for (const line of r.missingDetails) console.log(line);
    }
    if (r.unused.length) {
      console.log(`  UNUSED in ${r.exampleRel} (not referenced in code):`);
      for (const name of r.unused) console.log(`    - ${name}`);
    }
    console.log('');
  }

  if (hasError) {
    console.error('Environment parity check failed: missing example file(s).');
    process.exit(1);
  }

  if (hasDrift) {
    console.error('Environment parity check failed: drift detected.');
    console.error(
      'Update the .env.example file(s) or the allowlists in scripts/check-env-parity.mjs.',
    );
    process.exit(1);
  }

  console.log('Environment parity check passed.');
  process.exit(0);
}

main();