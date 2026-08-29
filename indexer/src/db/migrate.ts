/**
 * Database migration runner (#915).
 *
 * Convention (normalised in issue #915):
 *   - Up files   → `NNN_<description>_up.sql`
 *   - Down files → `NNN_<description>_down.sql`
 *
 * The migrations table records applied up-migrations by their base name
 * (e.g. `001_initial_schema`).  Running `migrate down` rolls back the most
 * recently applied migration by executing its `_down.sql` counterpart.
 */

import fs from 'fs';
import path from 'path';
import { getPool } from './client';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/** Derive the base name from a migration filename, e.g.
 *  "001_initial_schema_up.sql" → "001_initial_schema" */
function baseName(filename: string): string {
  return filename.replace(/_(up|down)\.sql$/, '');
}

/** Ensure the migrations tracking table exists. */
async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name       TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Run all pending up-migrations in ascending order.
 * Idempotent: already-applied migrations are skipped.
 */
export async function migrateUp(): Promise<void> {
  await ensureMigrationsTable();
  const pool = getPool();

  const upFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('_up.sql'))
    .sort();

  for (const file of upFiles) {
    const name = baseName(file);
    const { rows } = await pool.query(
      'SELECT 1 FROM migrations WHERE name = $1',
      [name],
    );
    if (rows.length > 0) {continue;} // already applied

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
    console.log(`[migrate up]   ${name}`);
  }
}

/**
 * Roll back the most recently applied migration.
 * Finds the corresponding `_down.sql` file and executes it.
 */
export async function migrateDown(): Promise<void> {
  await ensureMigrationsTable();
  const pool = getPool();

  // Find the last applied migration, ordered by name descending.
  const { rows } = await pool.query(
    'SELECT name FROM migrations ORDER BY name DESC LIMIT 1',
  );
  if (rows.length === 0) {
    console.log('[migrate down] Nothing to roll back.');
    return;
  }

  const name: string = rows[0].name;
  const downFile = path.join(MIGRATIONS_DIR, `${name}_down.sql`);

  if (!fs.existsSync(downFile)) {
    throw new Error(
      `Down migration not found for "${name}". Expected: ${downFile}`,
    );
  }

  const sql = fs.readFileSync(downFile, 'utf8');
  await pool.query(sql);
  await pool.query('DELETE FROM migrations WHERE name = $1', [name]);
  console.log(`[migrate down] ${name}`);
}

// ── CLI entry point ──────────────────────────────────────────────────────────

if (require.main === module) {
  require('dotenv').config();

  const direction = process.argv[2] ?? 'up';

  const run = direction === 'down' ? migrateDown : migrateUp;

  run()
    .then(() => {
      console.log(`Migrations (${direction}) complete.`);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

/** @deprecated Use `migrateUp()` directly. Kept for backwards compatibility. */
export const runMigrations = migrateUp;
