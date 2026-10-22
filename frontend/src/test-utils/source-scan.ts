import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

/** Absolute path of the frontend package root. Vitest runs from the package directory. */
export const FRONTEND_ROOT = resolve(process.cwd())

const SOURCE_FILE = /\.(ts|tsx)$/
const EXCLUDED_FILE = /\.(test|spec|stories)\.(ts|tsx)$/

/**
 * Lists production source files under src/, skipping tests, stories,
 * __tests__ folders and the src/test helpers. Returns paths relative to the
 * frontend root, using forward slashes.
 */
export function listProductionSourceFiles(dir = join(FRONTEND_ROOT, 'src')): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'test') continue
      files.push(...listProductionSourceFiles(full))
      continue
    }
    if (SOURCE_FILE.test(entry) && !EXCLUDED_FILE.test(entry)) {
      files.push(relative(FRONTEND_ROOT, full).split(sep).join('/'))
    }
  }
  return files
}

/** Returns `file:line` locations where `pattern` matches a line in the given files. */
export function findMatches(files: string[], pattern: RegExp): string[] {
  const hits: string[] = []
  for (const file of files) {
    readFileSync(join(FRONTEND_ROOT, file), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (pattern.test(line)) hits.push(`${file}:${i + 1}`)
      })
  }
  return hits
}
