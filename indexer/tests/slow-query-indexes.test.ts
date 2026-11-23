/**
 * Slow-query indexes are created by a migration with a matching rollback (#1702).
 */

import fs from 'fs'
import path from 'path'

const MIGRATIONS_DIR = path.join(__dirname, '../src/db/migrations')
const INDEXES = [
  'idx_wastes_is_confirmed',
  'idx_wastes_waste_type',
  'idx_wastes_type_active',
  'idx_wastes_registered_at',
  'idx_waste_transfers_transferred_at',
  'idx_participants_registered_at'
]

describe('slow-query index migration (#1702)', () => {
  const up = fs.readFileSync(path.join(MIGRATIONS_DIR, '004_slow_query_indexes_up.sql'), 'utf8')
  const down = fs.readFileSync(path.join(MIGRATIONS_DIR, '004_slow_query_indexes_down.sql'), 'utf8')

  it.each(INDEXES)('creates %s in the up migration', (name) => {
    expect(up).toContain(`CREATE INDEX IF NOT EXISTS ${name}`)
  })

  it.each(INDEXES)('drops %s in the down migration', (name) => {
    expect(down).toContain(`DROP INDEX IF EXISTS ${name}`)
  })
})
