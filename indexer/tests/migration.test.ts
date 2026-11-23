/**
 * #965 – DB migration up/down integration tests
 *
 * Applies every migration forward (up) then rolls each one back (down),
 * asserting schema state at each step.
 *
 * ── Requirements ────────────────────────────────────────────────────────────
 *   A running PostgreSQL instance reachable via DATABASE_URL.
 *   The target database must be a disposable test database — this suite
 *   drops all tables created by the migrations in beforeAll.
 *
 * ── How to run ──────────────────────────────────────────────────────────────
 *   # From /indexer:
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/scavngr_test \
 *     npx jest tests/migration.test.ts --runInBand
 *
 *   # In CI (assumes DATABASE_URL is set in the environment):
 *   npm run test:integration -- --testPathPattern migration
 *
 * ── What is tested ──────────────────────────────────────────────────────────
 *   1. Forward pass  – migrateUp() runs all pending SQL files, inserts rows
 *      into the migrations tracking table, and is idempotent.
 *   2. Per-migration schema assertions – tables and indexes introduced by
 *      each migration exist after it is applied.
 *   3. Reverse pass  – migrateDown() rolls back from newest to oldest,
 *      removes the tracking record, and the corresponding tables/indexes
 *      are absent afterwards.
 *   4. Round-trip    – a second migrateUp() fully restores the schema.
 *   5. File integrity – every up-migration has a down counterpart, both
 *      are non-empty, and base names are sequentially numbered.
 */

import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

// ─── Configuration ────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/scavngr_test'

const MIGRATIONS_DIR = path.join(__dirname, '../src/db/migrations')

// ─── Internal helpers (mirror src/db/migrate.ts logic on test pool) ──────────

function baseName(filename: string): string {
  return filename.replace(/_(up|down)\.sql$/, '')
}

function listMigrationNames(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('_up.sql'))
    .sort()
    .map(baseName)
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name       TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function migrateUp(pool: Pool): Promise<void> {
  await ensureMigrationsTable(pool)

  const upFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('_up.sql'))
    .sort()

  for (const file of upFiles) {
    const name = baseName(file)
    const { rows } = await pool.query('SELECT 1 FROM migrations WHERE name = $1', [name])
    if (rows.length > 0) continue // idempotent

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    await pool.query(sql)
    await pool.query('INSERT INTO migrations (name) VALUES ($1)', [name])
  }
}

async function migrateDown(pool: Pool): Promise<string | null> {
  await ensureMigrationsTable(pool)

  const { rows } = await pool.query<{ name: string }>(
    'SELECT name FROM migrations ORDER BY name DESC LIMIT 1'
  )
  if (rows.length === 0) return null

  const name: string = rows[0].name
  const downFile = path.join(MIGRATIONS_DIR, `${name}_down.sql`)

  if (!fs.existsSync(downFile)) {
    throw new Error(`Down-migration not found for "${name}". Expected: ${downFile}`)
  }

  const sql = fs.readFileSync(downFile, 'utf8')
  await pool.query(sql)
  await pool.query('DELETE FROM migrations WHERE name = $1', [name])
  return name
}

// ─── Schema query helpers ─────────────────────────────────────────────────────

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [table]
  )
  return rows[0].exists
}

async function indexExists(pool: Pool, index: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = $1
     ) AS exists`,
    [index]
  )
  return rows[0].exists
}

async function migrationRecorded(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM migrations WHERE name = $1
       ) AS exists`,
      [name]
    )
    return rows[0].exists
  } catch {
    return false // migrations table doesn't exist yet
  }
}

// ─── Per-migration schema contracts ──────────────────────────────────────────

interface MigrationContract {
  /** Tables introduced by this migration. */
  tables: string[]
  /** A representative subset of indexes introduced by this migration. */
  indexes?: string[]
}

const MIGRATION_CONTRACTS: Record<string, MigrationContract> = {
  '001_initial_schema': {
    tables: [
      'sync_status',
      'raw_events',
      'participants',
      'wastes',
      'waste_transfers',
      'token_rewards',
      'auctions',
      'carbon_credits'
    ],
    indexes: [
      'idx_raw_events_ledger',
      'idx_raw_events_type',
      'idx_raw_events_tx_type',
      'idx_participants_role',
      'idx_participants_search',
      'idx_wastes_recycler',
      'idx_wastes_type',
      'idx_wastes_active',
      'idx_transfers_waste',
      'idx_rewards_recipient',
      'idx_carbon_participant'
    ]
  },
  '002_alert_history': {
    tables: ['alert_history'],
    indexes: ['idx_alert_history_name', 'idx_alert_history_severity', 'idx_alert_history_created']
  },
  '003_audit_query_optimization': {
    tables: ['audit_logs'],
    indexes: [
      'idx_audit_actor',
      'idx_audit_action',
      'idx_audit_timestamp',
      'idx_audit_actor_action',
      'idx_wastes_type_registered',
      'idx_transfers_waste_time',
      'idx_participants_active'
    ]
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('#965 – DB migration up/down tests', () => {
  let pool: Pool

  // ── Setup / teardown ──────────────────────────────────────────────────────

  beforeAll(async () => {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000
    })

    // Verify connectivity before investing time in individual tests.
    try {
      await pool.query('SELECT 1')
    } catch (err) {
      throw new Error(
        `Cannot connect to test database.\n` +
          `Set DATABASE_URL to a disposable test DB and ensure Postgres is running.\n` +
          `DATABASE_URL: ${DATABASE_URL}\n` +
          `Error: ${String(err)}`
      )
    }

    // Drop everything the migrations create so we start from a clean slate.
    // Drop in reverse dependency order to avoid FK constraint errors.
    await pool.query(`
      DROP TABLE IF EXISTS
        audit_logs,
        alert_history,
        carbon_credits,
        auctions,
        token_rewards,
        waste_transfers,
        wastes,
        participants,
        raw_events,
        sync_status,
        migrations
      CASCADE
    `)
  }, 30_000)

  afterAll(async () => {
    if (pool) await pool.end()
  })

  // ─── 1. Forward pass ───────────────────────────────────────────────────────

  describe('Forward pass – migrateUp()', () => {
    it('applies all migrations without throwing', async () => {
      await expect(migrateUp(pool)).resolves.toBeUndefined()
    }, 30_000)

    it('creates the migrations tracking table', async () => {
      expect(await tableExists(pool, 'migrations')).toBe(true)
    })

    it('records every migration in the tracking table', async () => {
      for (const name of listMigrationNames()) {
        expect(await migrationRecorded(pool, name)).toBe(true)
      }
    })

    it('is idempotent – a second migrateUp() throws nothing', async () => {
      await expect(migrateUp(pool)).resolves.toBeUndefined()
    })
  })

  // ─── 2. Per-migration schema assertions (post-up) ─────────────────────────

  describe('Post-up schema assertions', () => {
    for (const [migName, contract] of Object.entries(MIGRATION_CONTRACTS)) {
      describe(`${migName}`, () => {
        for (const table of contract.tables) {
          it(`table "${table}" exists`, async () => {
            expect(await tableExists(pool, table)).toBe(true)
          })
        }
        for (const idx of contract.indexes ?? []) {
          it(`index "${idx}" exists`, async () => {
            expect(await indexExists(pool, idx)).toBe(true)
          })
        }
      })
    }
  })

  // ─── 3. Reverse pass – roll back each migration newest-first ─────────────

  describe('Reverse pass – migrateDown()', () => {
    const reversedNames = [...listMigrationNames()].reverse()

    for (const migName of reversedNames) {
      const contract = MIGRATION_CONTRACTS[migName]

      describe(`Roll back ${migName}`, () => {
        let rolledBack: string | null

        beforeAll(async () => {
          rolledBack = await migrateDown(pool)
        }, 30_000)

        it('returns the correct migration name', () => {
          expect(rolledBack).toBe(migName)
        })

        it('removes the row from the tracking table', async () => {
          expect(await migrationRecorded(pool, migName)).toBe(false)
        })

        if (contract) {
          for (const table of contract.tables) {
            it(`table "${table}" no longer exists`, async () => {
              expect(await tableExists(pool, table)).toBe(false)
            })
          }

          for (const idx of contract.indexes ?? []) {
            it(`index "${idx}" no longer exists`, async () => {
              expect(await indexExists(pool, idx)).toBe(false)
            })
          }
        }
      })
    }

    it('returns null when there is nothing left to roll back', async () => {
      expect(await migrateDown(pool)).toBeNull()
    })
  })

  // ─── 4. Round-trip – full up → down → up ─────────────────────────────────

  describe('Round-trip – up → down → up', () => {
    it('second migrateUp() fully restores the schema', async () => {
      await expect(migrateUp(pool)).resolves.toBeUndefined()

      // Spot-check the initial schema tables are present again.
      for (const table of MIGRATION_CONTRACTS['001_initial_schema'].tables) {
        expect(await tableExists(pool, table)).toBe(true)
      }
    }, 30_000)

    it('all migrations are tracked after the second migrateUp()', async () => {
      for (const name of listMigrationNames()) {
        expect(await migrationRecorded(pool, name)).toBe(true)
      }
    })
  })

  // ─── 5. Migration file integrity ─────────────────────────────────────────

  describe('Migration file integrity', () => {
    it('at least one migration file pair exists', () => {
      expect(listMigrationNames().length).toBeGreaterThan(0)
    })

    it('every up-migration has a corresponding down-migration file', () => {
      for (const name of listMigrationNames()) {
        const downPath = path.join(MIGRATIONS_DIR, `${name}_down.sql`)
        expect(fs.existsSync(downPath)).toBe(true)
      }
    })

    it('up-migration files are non-empty', () => {
      for (const name of listMigrationNames()) {
        const content = fs.readFileSync(path.join(MIGRATIONS_DIR, `${name}_up.sql`), 'utf8')
        expect(content.trim().length).toBeGreaterThan(0)
      }
    })

    it('down-migration files are non-empty', () => {
      for (const name of listMigrationNames()) {
        const content = fs.readFileSync(path.join(MIGRATIONS_DIR, `${name}_down.sql`), 'utf8')
        expect(content.trim().length).toBeGreaterThan(0)
      }
    })

    it('migration base names are sequentially numbered without gaps', () => {
      const names = listMigrationNames()
      names.forEach((name, i) => {
        const expected = String(i + 1).padStart(3, '0')
        expect(name).toMatch(new RegExp(`^${expected}_`))
      })
    })

    it('migration base names in MIGRATION_CONTRACTS match files on disk', () => {
      const onDisk = new Set(listMigrationNames())
      for (const name of Object.keys(MIGRATION_CONTRACTS)) {
        expect(onDisk.has(name)).toBe(true)
      }
    })
  })
})
