/**
 * Every up migration has a matching down migration, so each one can be rolled back (#1713).
 */

import fs from 'fs'
import path from 'path'

const MIGRATIONS_DIR = path.join(__dirname, '../src/db/migrations')

describe('migration rollback pairs (#1713)', () => {
  const files = fs.readdirSync(MIGRATIONS_DIR)
  const upFiles = files.filter((f) => f.endsWith('_up.sql'))

  it('has at least one up migration', () => {
    expect(upFiles.length).toBeGreaterThan(0)
  })

  it.each(upFiles)('%s has a matching _down.sql file', (upFile) => {
    const downFile = upFile.replace(/_up\.sql$/, '_down.sql')

    expect(files).toContain(downFile)
  })

  it('has no down migration without an up migration', () => {
    const orphans = files
      .filter((f) => f.endsWith('_down.sql'))
      .filter((f) => !files.includes(f.replace(/_down\.sql$/, '_up.sql')))

    expect(orphans).toEqual([])
  })
})
