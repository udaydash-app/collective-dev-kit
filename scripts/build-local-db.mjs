#!/usr/bin/env node
// Build-time script: dumps the cloud Postgres schema + data into `data/`
// and pre-seeds a PGlite snapshot at `data/pglite/`.
//
// Usage:
//   DATABASE_URL='postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres' \
//     node scripts/build-local-db.mjs
//
// The installer then ships everything inside `data/` as extraResources.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const DATA_DIR = join(ROOT, 'data');
const PGLITE_DIR = join(DATA_DIR, 'pglite');
const SCHEMA_SQL = join(DATA_DIR, 'schema.sql');
const SEED_SQL = join(DATA_DIR, 'seed.sql');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('ERROR: DATABASE_URL env var is required.');
  console.error('Get it from Supabase → Project Settings → Database → Connection string (URI).');
  process.exit(1);
}

mkdirSync(DATA_DIR, { recursive: true });

console.log('[build-local-db] Dumping schema...');
execSync(
  `pg_dump --schema-only --no-owner --no-privileges --schema=public --schema=extensions "${url}" > "${SCHEMA_SQL}"`,
  { stdio: 'inherit', shell: '/bin/bash' },
);

console.log('[build-local-db] Dumping data...');
// Skip auth/storage tables — those are Supabase-managed and don't exist in PGlite.
execSync(
  `pg_dump --data-only --no-owner --no-privileges --schema=public --disable-triggers "${url}" > "${SEED_SQL}"`,
  { stdio: 'inherit', shell: '/bin/bash' },
);

// --- Post-process the schema to make it PGlite-friendly ---
console.log('[build-local-db] Post-processing schema for PGlite...');
let schema = readFileSync(SCHEMA_SQL, 'utf-8');

// Drop FK references to auth.users — they don't exist locally.
schema = schema.replace(/REFERENCES auth\.users\([^)]*\)[^,;]*/gi, '');
// Strip RLS / policy / GRANT clutter — single-user local DB.
schema = schema.replace(/^(ALTER TABLE [^;]*ENABLE ROW LEVEL SECURITY;)$/gim, '-- $1');
schema = schema.replace(/^CREATE POLICY [^;]+;/gim, '-- (policy stripped)');
schema = schema.replace(/^GRANT [^;]+;/gim, '-- (grant stripped)');
schema = schema.replace(/^REVOKE [^;]+;/gim, '-- (revoke stripped)');

import('node:fs').then(({ writeFileSync }) => writeFileSync(SCHEMA_SQL, schema));

// --- Pre-seed a PGlite snapshot so installer ships a ready DB ---
console.log('[build-local-db] Building PGlite snapshot...');
if (existsSync(PGLITE_DIR)) rmSync(PGLITE_DIR, { recursive: true, force: true });

const { PGlite } = await import('@electric-sql/pglite');
const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm');
const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');

const db = await PGlite.create({
  dataDir: PGLITE_DIR,
  extensions: { pg_trgm, pgcrypto },
});

const schemaSql = readFileSync(SCHEMA_SQL, 'utf-8');
const seedSql = readFileSync(SEED_SQL, 'utf-8');

try {
  await db.exec(schemaSql);
  console.log('[build-local-db] Schema applied');
} catch (e) {
  console.warn('[build-local-db] Schema apply had errors (continuing):', e.message);
}
try {
  await db.exec(seedSql);
  console.log('[build-local-db] Seed applied');
} catch (e) {
  console.warn('[build-local-db] Seed apply had errors (continuing):', e.message);
}

await db.close();
console.log('[build-local-db] Done. Snapshot at', PGLITE_DIR);