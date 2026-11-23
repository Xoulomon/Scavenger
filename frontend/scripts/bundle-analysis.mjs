#!/usr/bin/env node
/**
 * bundle-analysis.mjs
 *
 * Measures the production bundle output produced by `vite build`.
 * Run after building: `node scripts/bundle-analysis.mjs`
 *
 * Outputs:
 *   - Initial chunks (entry + eagerly-imported modules)
 *   - Lazy chunks (route-level code-split chunks)
 *   - Total bundle size
 *   - Chunk count
 *
 * Exit code 1 if the initial JS bundle exceeds the configured threshold.
 */

import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist', 'assets')

// ── Thresholds ────────────────────────────────────────────────────────────────
// Adjust if the budget changes.  Values in KB (uncompressed).
const INITIAL_BUNDLE_WARN_KB = 200 // warn if initial JS > 200 KB
const INITIAL_BUNDLE_FAIL_KB = 350 // fail CI if initial JS > 350 KB

// ── Helpers ───────────────────────────────────────────────────────────────────
function toKB(bytes) {
  return (bytes / 1024).toFixed(1)
}

function padEnd(str, len) {
  return String(str).padEnd(len, ' ')
}

function padStart(str, len) {
  return String(str).padStart(len, ' ')
}

// ── Main ──────────────────────────────────────────────────────────────────────
if (!existsSync(distDir)) {
  console.error(`\n❌  dist/assets not found. Run \`npm run build\` first.\n`)
  process.exit(1)
}

const files = readdirSync(distDir).filter((f) => extname(f) === '.js')

if (files.length === 0) {
  console.error('\n❌  No JS files found in dist/assets.\n')
  process.exit(1)
}

const chunks = files.map((file) => {
  const filePath = join(distDir, file)
  const size = statSync(filePath).size

  // Vite names the entry chunk "index-[hash].js"; other chunks get a content-
  // addressable hash.  We identify the entry by the "index" prefix.
  const isEntry = basename(file).startsWith('index')
  return { file, size, isEntry }
})

chunks.sort((a, b) => b.size - a.size)

const totalBytes = chunks.reduce((s, c) => s + c.size, 0)
const initialBytes = chunks.filter((c) => c.isEntry).reduce((s, c) => s + c.size, 0)
const lazyChunks = chunks.filter((c) => !c.isEntry)
const initialChunks = chunks.filter((c) => c.isEntry)

// ── Report ────────────────────────────────────────────────────────────────────
const COL1 = 50
const COL2 = 10

console.log('\n📦  Bundle Analysis Report')
console.log('='.repeat(COL1 + COL2 + 4))

console.log('\n🔵  Initial chunks (loaded on every page visit)')
console.log('-'.repeat(COL1 + COL2 + 4))
for (const { file, size } of initialChunks) {
  console.log(`  ${padEnd(file, COL1)} ${padStart(toKB(size) + ' KB', COL2)}`)
}

console.log('\n🟢  Lazy chunks (loaded only when the route is visited)')
console.log('-'.repeat(COL1 + COL2 + 4))
for (const { file, size } of lazyChunks) {
  console.log(`  ${padEnd(file, COL1)} ${padStart(toKB(size) + ' KB', COL2)}`)
}

console.log('\n' + '='.repeat(COL1 + COL2 + 4))
console.log(`  ${'Total JS'.padEnd(COL1)} ${padStart(toKB(totalBytes) + ' KB', COL2)}`)
console.log(`  ${'Initial JS'.padEnd(COL1)} ${padStart(toKB(initialBytes) + ' KB', COL2)}`)
console.log(`  ${'Lazy chunks'.padEnd(COL1)} ${padStart(lazyChunks.length, COL2)}`)
console.log('='.repeat(COL1 + COL2 + 4))

// ── Budget check ──────────────────────────────────────────────────────────────
const initialKB = initialBytes / 1024

if (initialKB > INITIAL_BUNDLE_FAIL_KB) {
  console.error(
    `\n❌  Initial bundle (${toKB(initialBytes)} KB) exceeds the failure threshold of ${INITIAL_BUNDLE_FAIL_KB} KB.\n`
  )
  process.exit(1)
}

if (initialKB > INITIAL_BUNDLE_WARN_KB) {
  console.warn(
    `\n⚠️   Initial bundle (${toKB(initialBytes)} KB) exceeds the warning threshold of ${INITIAL_BUNDLE_WARN_KB} KB.`
  )
  console.warn('    Consider splitting large dependencies further.\n')
} else {
  console.log(
    `\n✅  Initial bundle (${toKB(initialBytes)} KB) is within budget (< ${INITIAL_BUNDLE_WARN_KB} KB).\n`
  )
}
