#!/usr/bin/env ts-node
/**
 * Test data seeding script for the Scavngr indexer database.
 *
 * Issue #956 – Add test data seeding scripts.
 *
 * Usage:
 *   # Using ts-node directly
 *   npx ts-node scripts/seed-test-data.ts
 *
 *   # With a custom DATABASE_URL
 *   DATABASE_URL=postgres://... npx ts-node scripts/seed-test-data.ts
 *
 *   # Dry-run (prints SQL without executing)
 *   DRY_RUN=true npx ts-node scripts/seed-test-data.ts
 *
 *   # Wipe existing seed data before re-seeding
 *   CLEAN=true npx ts-node scripts/seed-test-data.ts
 *
 * Environment variables:
 *   DATABASE_URL  – postgres connection string (defaults to localhost dev DB)
 *   DRY_RUN       – if "true", print SQL instead of executing it
 *   CLEAN         – if "true", delete all existing seed rows before inserting
 *   SEED_LEDGER   – starting ledger for synthetic event numbers (default: 1000)
 */

import { Pool } from 'pg'
import * as path from 'path'
import * as fs from 'fs'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/scavngr_dev'

const DRY_RUN = process.env.DRY_RUN === 'true'
const CLEAN = process.env.CLEAN === 'true'
const BASE_LEDGER = Number(process.env.SEED_LEDGER ?? 1000)

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const CONTRACT_ID = 'CONTRACT_SEED_ID_001'

interface SeedParticipant {
  address: string
  role: 'Recycler' | 'Collector' | 'Manufacturer'
  name: string
  latitude: number
  longitude: number
  registeredAtLedger: number
  registeredAt: string
  isActive: boolean
}

const SEED_PARTICIPANTS: SeedParticipant[] = [
  // Recyclers
  {
    address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    role: 'Recycler',
    name: 'Alice Kamau',
    latitude: -1.2921,
    longitude: 36.8219,
    registeredAtLedger: BASE_LEDGER,
    registeredAt: '2024-01-15T10:30:00.000Z',
    isActive: true
  },
  {
    address: 'GBKGJTSMPLC54YDKYZPAWKQ4HFSJCLB6PWDX36AFZDLXO3YLQAZFXBO',
    role: 'Recycler',
    name: 'Bob Omondi',
    latitude: -1.3031,
    longitude: 36.7073,
    registeredAtLedger: BASE_LEDGER + 50,
    registeredAt: '2024-01-16T08:00:00.000Z',
    isActive: true
  },
  {
    address: 'GCUGB2S2WETD2VBUAV2CKUGKYY63JTFNOXIN2XRXHEQNLSOMKGXNB3T',
    role: 'Recycler',
    name: 'Carol Wanjiru',
    latitude: -1.2707,
    longitude: 36.8126,
    registeredAtLedger: BASE_LEDGER + 100,
    registeredAt: '2024-01-17T09:15:00.000Z',
    isActive: true
  },
  {
    address: 'GDC3W2X5KUTZPURLOQNHLDWYFNZV26Y7IZIUAASYGXQQAIVVPZP6GK4',
    role: 'Recycler',
    name: 'David Mwangi',
    latitude: -1.288,
    longitude: 36.824,
    registeredAtLedger: BASE_LEDGER + 150,
    registeredAt: '2024-01-18T11:00:00.000Z',
    isActive: false
  },
  // Collectors
  {
    address: 'GCITNMB4RRXQHBOPVV42LH2T5NHPD6L5PO23XCJZSKJJBR5Z3GIHKZF',
    role: 'Collector',
    name: 'Eve Collector',
    latitude: -1.304,
    longitude: 36.72,
    registeredAtLedger: BASE_LEDGER + 200,
    registeredAt: '2024-01-20T14:00:00.000Z',
    isActive: true
  },
  {
    address: 'GDYMQMZJUVXMHF4MJKLZPCRJPPOPVKGKQDBVPQ6HDWLZAXOFZ5TKM52',
    role: 'Collector',
    name: 'Frank Njoroge',
    latitude: -1.26,
    longitude: 36.79,
    registeredAtLedger: BASE_LEDGER + 250,
    registeredAt: '2024-01-22T12:30:00.000Z',
    isActive: true
  },
  {
    address: 'GBQPMBZLGKL2GV47SFKLFYIMHBBYUVDHDSJG46SRO3RMYPKYXRGJPB3',
    role: 'Collector',
    name: 'Grace Achieng',
    latitude: -1.299,
    longitude: 36.83,
    registeredAtLedger: BASE_LEDGER + 300,
    registeredAt: '2024-01-25T09:00:00.000Z',
    isActive: true
  },
  // Manufacturers
  {
    address: 'GCMF7MH5YYVKYUIBBIGZR3OEBBSLSTMKPDBV5AQMG63O6I5QRS3C3QQ',
    role: 'Manufacturer',
    name: 'Acme Recycling Ltd',
    latitude: -1.285,
    longitude: 36.82,
    registeredAtLedger: BASE_LEDGER + 400,
    registeredAt: '2024-02-01T08:00:00.000Z',
    isActive: true
  },
  {
    address: 'GBKLFASDL2NLKJDSF3AAAGDVNMKJZXBCSDGABD3NAKJDSFH4NLKJASDF',
    role: 'Manufacturer',
    name: 'GreenPak Industries',
    latitude: -1.27,
    longitude: 36.81,
    registeredAtLedger: BASE_LEDGER + 450,
    registeredAt: '2024-02-05T10:00:00.000Z',
    isActive: true
  },
  {
    address: 'GBNAIKJDSLAKJSDFLKJASDFKLJ3NKJ2BSDFASDFKLJ3NKJSDFLAKJDSF',
    role: 'Manufacturer',
    name: 'EcoMelt Corp',
    latitude: -1.265,
    longitude: 36.805,
    registeredAtLedger: BASE_LEDGER + 500,
    registeredAt: '2024-02-10T13:00:00.000Z',
    isActive: false
  }
]

interface SeedEvent {
  ledgerSequence: number
  transactionHash: string
  contractId: string
  eventType: string
  topic: object
  value: object
  createdAt: string
}

function buildEvents(): SeedEvent[] {
  const events: SeedEvent[] = []
  const L = BASE_LEDGER

  // Registration events
  for (let i = 0; i < SEED_PARTICIPANTS.length; i++) {
    const p = SEED_PARTICIPANTS[i]
    events.push({
      ledgerSequence: p.registeredAtLedger,
      transactionHash: `tx_seed_reg_${String(i + 1).padStart(3, '0')}_${'a'.repeat(56)}`,
      contractId: CONTRACT_ID,
      eventType: 'ParticipantRegistered',
      topic: ['ParticipantRegistered'],
      value: {
        address: p.address,
        role: ['Recycler', 'Collector', 'Manufacturer'].indexOf(p.role)
      },
      createdAt: p.registeredAt
    })
  }

  // Waste submission events (4 waste items)
  const wasteItems = [
    { id: 1, type: 2, weight: 5000, submitter: SEED_PARTICIPANTS[0].address }, // Plastic
    { id: 2, type: 0, weight: 3000, submitter: SEED_PARTICIPANTS[1].address }, // Paper
    { id: 3, type: 3, weight: 8000, submitter: SEED_PARTICIPANTS[2].address }, // Metal
    { id: 4, type: 5, weight: 12000, submitter: SEED_PARTICIPANTS[0].address } // Organic
  ]

  wasteItems.forEach((w, i) => {
    events.push({
      ledgerSequence: L + 1000 + i * 10,
      transactionHash: `tx_seed_waste_${String(i + 1).padStart(3, '0')}_${'b'.repeat(55)}`,
      contractId: CONTRACT_ID,
      eventType: 'WasteRegistered',
      topic: ['WasteRegistered'],
      value: { waste_id: w.id, waste_type: w.type, weight: w.weight, submitter: w.submitter },
      createdAt: new Date(Date.UTC(2024, 1, 15 + i, 10, 0, 0)).toISOString()
    })
  })

  // Transfer events
  const transfers = [
    { waste_id: 1, from: SEED_PARTICIPANTS[0].address, to: SEED_PARTICIPANTS[4].address },
    { waste_id: 1, from: SEED_PARTICIPANTS[4].address, to: SEED_PARTICIPANTS[7].address },
    { waste_id: 2, from: SEED_PARTICIPANTS[1].address, to: SEED_PARTICIPANTS[5].address }
  ]

  transfers.forEach((t, i) => {
    events.push({
      ledgerSequence: L + 2000 + i * 10,
      transactionHash: `tx_seed_xfer_${String(i + 1).padStart(3, '0')}_${'c'.repeat(55)}`,
      contractId: CONTRACT_ID,
      eventType: 'WasteTransferred',
      topic: ['WasteTransferred'],
      value: t,
      createdAt: new Date(Date.UTC(2024, 1, 20 + i, 10, 0, 0)).toISOString()
    })
  })

  // Incentive creation events
  const incentives = [
    {
      id: 1,
      rewarder: SEED_PARTICIPANTS[7].address,
      waste_type: 2,
      reward_points: 100,
      budget: 10000
    },
    {
      id: 2,
      rewarder: SEED_PARTICIPANTS[7].address,
      waste_type: 0,
      reward_points: 50,
      budget: 5000
    }
  ]

  incentives.forEach((inc, i) => {
    events.push({
      ledgerSequence: L + 3000 + i * 10,
      transactionHash: `tx_seed_incv_${String(i + 1).padStart(3, '0')}_${'d'.repeat(55)}`,
      contractId: CONTRACT_ID,
      eventType: 'IncentiveCreated',
      topic: ['IncentiveCreated'],
      value: inc,
      createdAt: new Date(Date.UTC(2024, 2, 1 + i, 8, 0, 0)).toISOString()
    })
  })

  return events
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

function ensureSchema(): string {
  return `
CREATE TABLE IF NOT EXISTS sync_status (
  id          SERIAL PRIMARY KEY,
  last_ledger BIGINT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS participants (
  address              VARCHAR(64)  PRIMARY KEY,
  role                 VARCHAR(20)  NOT NULL,
  name                 VARCHAR(255) NOT NULL,
  latitude             DECIMAL(10,6),
  longitude            DECIMAL(10,6),
  registered_at_ledger BIGINT       NOT NULL DEFAULT 0,
  registered_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  is_active            BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS raw_events (
  id               SERIAL PRIMARY KEY,
  ledger_sequence  BIGINT       NOT NULL,
  transaction_hash VARCHAR(128) NOT NULL,
  contract_id      VARCHAR(64)  NOT NULL,
  event_type       VARCHAR(128) NOT NULL,
  topic            JSONB,
  value            JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_rewards (
  id                SERIAL PRIMARY KEY,
  recipient_address VARCHAR(64) NOT NULL,
  amount            BIGINT      NOT NULL DEFAULT 0,
  waste_id          BIGINT,
  rewarded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
  `.trim()
}

function cleanSql(): string {
  return `
-- Remove seed data (identified by CONTRACT_SEED_ID_001)
DELETE FROM raw_events WHERE contract_id = '${CONTRACT_ID}';
DELETE FROM token_rewards WHERE waste_id IN (1, 2, 3, 4);
DELETE FROM participants WHERE address IN (
  ${SEED_PARTICIPANTS.map((p) => `'${p.address}'`).join(',\n  ')}
);
INSERT INTO sync_status (id, last_ledger, updated_at) VALUES (1, 0, NOW())
  ON CONFLICT (id) DO UPDATE SET last_ledger = 0, updated_at = NOW();
  `.trim()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log('🌱  Scavngr test data seeder')
  console.log(`   DRY_RUN : ${DRY_RUN}`)
  console.log(`   CLEAN   : ${CLEAN}`)
  console.log(`   DB URL  : ${DATABASE_URL.replace(/:\/\/[^@]+@/, '://<redacted>@')}`)
  console.log()

  const schemaSQL = ensureSchema()
  const cleanSQL = cleanSql()
  const eventsList = buildEvents()

  // Build participants SQL
  const participantValues = SEED_PARTICIPANTS.map(
    (p) =>
      `('${p.address}', '${p.role}', '${p.name}', ${p.latitude}, ${p.longitude}, ` +
      `${p.registeredAtLedger}, '${p.registeredAt}', ${p.isActive})`
  ).join(',\n  ')

  const participantSQL = `
INSERT INTO participants
  (address, role, name, latitude, longitude, registered_at_ledger, registered_at, is_active)
VALUES
  ${participantValues}
ON CONFLICT (address) DO UPDATE SET
  role                 = EXCLUDED.role,
  name                 = EXCLUDED.name,
  latitude             = EXCLUDED.latitude,
  longitude            = EXCLUDED.longitude,
  registered_at_ledger = EXCLUDED.registered_at_ledger,
  registered_at        = EXCLUDED.registered_at,
  is_active            = EXCLUDED.is_active;`.trim()

  const eventValues = eventsList
    .map(
      (e) =>
        `(${e.ledgerSequence}, '${e.transactionHash}', '${e.contractId}', '${e.eventType}', ` +
        `'${JSON.stringify(e.topic)}'::jsonb, '${JSON.stringify(e.value)}'::jsonb, '${e.createdAt}')`
    )
    .join(',\n  ')

  const eventSQL = `
INSERT INTO raw_events
  (ledger_sequence, transaction_hash, contract_id, event_type, topic, value, created_at)
VALUES
  ${eventValues}
ON CONFLICT DO NOTHING;`.trim()

  const syncSQL = `
INSERT INTO sync_status (id, last_ledger, updated_at) VALUES (1, 0, NOW())
  ON CONFLICT (id) DO UPDATE SET last_ledger = 0, updated_at = NOW();`.trim()

  if (DRY_RUN) {
    console.log('--- DRY RUN: SQL that would be executed ---\n')
    console.log('-- 1. Ensure schema\n', schemaSQL)
    if (CLEAN) console.log('\n-- 2. Clean seed data\n', cleanSQL)
    console.log('\n-- 3. Seed sync_status\n', syncSQL)
    console.log('\n-- 4. Seed participants\n', participantSQL)
    console.log('\n-- 5. Seed events\n', eventSQL)
    console.log('\n--- End of dry run ---')
    return
  }

  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      console.log('✔  Ensuring schema exists…')
      await client.query(schemaSQL)

      if (CLEAN) {
        console.log('🧹  Cleaning existing seed data…')
        await client.query(cleanSQL)
      }

      console.log('✔  Seeding sync_status…')
      await client.query(syncSQL)

      console.log(`✔  Seeding ${SEED_PARTICIPANTS.length} participants…`)
      await client.query(participantSQL)

      console.log(`✔  Seeding ${eventsList.length} events…`)
      await client.query(eventSQL)

      await client.query('COMMIT')
      console.log('\n✅  Seeding complete.')
      console.log(`   Participants : ${SEED_PARTICIPANTS.length}`)
      console.log(`   Events       : ${eventsList.length}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

seed().catch((err) => {
  console.error('❌  Seeding failed:', err)
  process.exit(1)
})
