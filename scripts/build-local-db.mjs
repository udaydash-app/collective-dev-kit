#!/usr/bin/env node
// Build-time script: dumps the cloud Postgres schema + data into `data/`
// and pre-seeds a PGlite snapshot at `data/pglite/`.
//
// Usage:
//   DATABASE_URL='postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres' \
//     node scripts/build-local-db.mjs
//
// The installer then ships everything inside `data/` as extraResources.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
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
if (url.includes('YOUR_PASSWORD')) {
  console.error('ERROR: DATABASE_URL still contains the placeholder "YOUR_PASSWORD".');
  console.error('Replace it with your real Supabase DB password (Project Settings → Database → Connection string).');
  process.exit(1);
}

mkdirSync(DATA_DIR, { recursive: true });

function runPgDump(args, outFile) {
  const fd = openSync(outFile, 'w');
  const res = spawnSync('pg_dump', args, {
    stdio: ['ignore', fd, 'inherit'],
    shell: false,
  });
  closeSync(fd);
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      console.error('\nERROR: `pg_dump` was not found in PATH.');
      console.error('Install PostgreSQL client tools:');
      console.error('  Windows: https://www.postgresql.org/download/windows/ (then add C:\\Program Files\\PostgreSQL\\<ver>\\bin to PATH)');
      console.error('  macOS:   brew install libpq && brew link --force libpq');
      console.error('  Linux:   sudo apt-get install postgresql-client');
      process.exit(1);
    }
    throw res.error;
  }
  if (res.status !== 0) {
    console.error(`pg_dump exited with code ${res.status}`);
    process.exit(res.status ?? 1);
  }
}

console.log('[build-local-db] Dumping schema...');
runPgDump(
  ['--schema-only', '--no-owner', '--no-privileges', '--schema=public', '--schema=extensions', url],
  SCHEMA_SQL,
);

console.log('[build-local-db] Dumping data...');
// Skip auth/storage tables — those are Supabase-managed and don't exist in PGlite.
runPgDump(
  ['--data-only', '--no-owner', '--no-privileges', '--schema=public', '--inserts', '--rows-per-insert=100', url],
  SEED_SQL,
);

// --- Post-process the schema to make it PGlite-friendly ---
console.log('[build-local-db] Post-processing schema for PGlite...');
let schema = readFileSync(SCHEMA_SQL, 'utf-8');

// pg_dump 17+ may emit psql-only \restrict / \unrestrict guard lines.
schema = schema.replace(/^\\(?:un)?restrict\b.*$/gim, '');
// Drop FK references to auth.users — they don't exist locally.
schema = schema.replace(/\s*REFERENCES auth\.users\s*\([^)]*\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+\w+(?:\s+\w+)?)*/gi, '');

writeFileSync(SCHEMA_SQL, schema);

let seed = readFileSync(SEED_SQL, 'utf-8');
// Keep seed SQL executable through PGlite's SQL API, not psql.
seed = seed.replace(/^\\(?:un)?restrict\b.*$/gim, '');
seed = seed.replace(/^ALTER TABLE [^;]+ (?:DISABLE|ENABLE) TRIGGER ALL;$/gim, '-- (trigger toggle stripped)');
writeFileSync(SEED_SQL, seed);

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

// Split a SQL script into top-level statements, respecting dollar-quoted bodies
// (e.g. function definitions) and line/block comments. Required so a single bad
// statement doesn't abort the whole batch the way db.exec() would.
function splitSqlStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  let inSingle = false;
  let inDollar = null; // current dollar tag like "$$" or "$func$"
  let inLineComment = false;
  let inBlockComment = false;
  while (i < sql.length) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);
    if (inLineComment) {
      buf += ch;
      if (ch === '\n') inLineComment = false;
      i++; continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (next2 === '*/') { buf += '/'; i += 2; inBlockComment = false; continue; }
      i++; continue;
    }
    if (inDollar) {
      buf += ch;
      if (sql.startsWith(inDollar, i)) {
        buf += inDollar.slice(1);
        i += inDollar.length;
        inDollar = null;
        continue;
      }
      i++; continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") { buf += "'"; i += 2; continue; }
        inSingle = false;
      }
      i++; continue;
    }
    if (next2 === '--') { inLineComment = true; buf += ch; i++; continue; }
    if (next2 === '/*') { inBlockComment = true; buf += ch; i++; continue; }
    if (ch === "'") { inSingle = true; buf += ch; i++; continue; }
    if (ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (m) { inDollar = m[0]; buf += m[0]; i += m[0].length; continue; }
    }
    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      i++; continue;
    }
    buf += ch;
    i++;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

async function applySqlPiecewise(label, sql) {
  const stmts = splitSqlStatements(sql);
  // Strip leading SQL comments/whitespace so skip-pattern detection works.
  const stripLeading = (s) => s.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '');
  const SKIP_RE = /^(GRANT|REVOKE|CREATE\s+POLICY|ALTER\s+POLICY|DROP\s+POLICY|ALTER\s+(TABLE|SCHEMA|FUNCTION|DEFAULT\s+PRIVILEGES)[\s\S]*ENABLE\s+ROW\s+LEVEL\s+SECURITY|ALTER\s+PUBLICATION|CREATE\s+PUBLICATION|CREATE\s+SUBSCRIPTION|ALTER\s+SUBSCRIPTION|COMMENT\s+ON|SET\s+|SELECT\s+pg_catalog\.|CREATE\s+EVENT\s+TRIGGER|CREATE\s+SCHEMA\s+public\b)/i;

  // Multi-pass: dependencies (e.g. function created before table it references)
  // may fail on first pass and succeed later. Retry until no progress.
  let pending = stmts
    .map((s) => ({ raw: s, head: stripLeading(s) }))
    .filter((s) => s.head && !SKIP_RE.test(s.head));
  let ok = 0;
  let lastFail = -1;
  let passes = 0;
  let errors = [];
  while (pending.length && pending.length !== lastFail && passes < 5) {
    lastFail = pending.length;
    passes++;
    const next = [];
    errors = [];
    for (const s of pending) {
      try {
        await db.exec(s.raw);
        ok++;
      } catch (e) {
        next.push(s);
        if (errors.length < 10) errors.push(`${e.message}\n  -> ${s.head.slice(0, 160).replace(/\s+/g, ' ')}`);
      }
    }
    pending = next;
  }
  console.log(`[build-local-db] ${label}: ${ok} ok, ${pending.length} failed (${passes} passes)`);
  if (errors.length) {
    console.warn(`[build-local-db] First ${errors.length} ${label} errors:`);
    for (const e of errors) console.warn('  -', e);
  }
}

// Bootstrap shims PGlite needs before applying the dump:
//  - auth schema + minimal auth.users so FK references resolve
//  - extensions.gen_random_bytes alias to pgcrypto's function
//  - user_roles + app_role enum (real definitions come from the dump too,
//    but the dump creates functions referencing them out of order)
const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  created_at timestamptz DEFAULT now()
);
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE OR REPLACE FUNCTION extensions.gen_random_bytes(integer)
  RETURNS bytea LANGUAGE sql AS $$ SELECT public.gen_random_bytes($1) $$;
CREATE OR REPLACE FUNCTION extensions.gen_random_uuid()
  RETURNS uuid LANGUAGE sql AS $$ SELECT public.gen_random_uuid() $$;
`;
for (const stmt of splitSqlStatements(BOOTSTRAP_SQL)) {
  try { await db.exec(stmt); } catch (e) { console.warn('[build-local-db] bootstrap warn:', e.message); }
}

await applySqlPiecewise('Schema', schemaSql);
await applySqlPiecewise('Seed', seedSql);

await db.close();
console.log('[build-local-db] Done. Snapshot at', PGLITE_DIR);