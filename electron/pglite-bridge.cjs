// Embedded PGlite (Postgres in WASM) bridge for Electron main process.
// On first launch, copies the bundled snapshot from `resources/data/pglite`
// to the per-user writable location (`userData/data/pglite`). All renderer
// DB calls funnel through IPC channels exposed here.

const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let pgliteInstance = null;
let initPromise = null;

function resolveBundledDataDir() {
  // In packaged app: process.resourcesPath/data; in dev: <repo>/data
  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'data'))) {
    return path.join(process.resourcesPath, 'data');
  }
  return path.join(__dirname, '..', 'data');
}

function resolveUserDataDir() {
  return path.join(app.getPath('userData'), 'data', 'pglite');
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
  return true;
}

async function ensureSeeded(userDir) {
  if (fs.existsSync(userDir) && fs.readdirSync(userDir).length > 0) return;
  const bundled = path.join(resolveBundledDataDir(), 'pglite');
  if (fs.existsSync(bundled)) {
    console.log('[PGlite] Seeding userData from bundled snapshot');
    copyDirRecursive(bundled, userDir);
    return;
  }
  // No bundled snapshot — try applying schema.sql + seed.sql freshly.
  console.log('[PGlite] No bundled snapshot; initialising empty DB');
  fs.mkdirSync(userDir, { recursive: true });
}

async function applySqlFilesIfFresh(pglite) {
  // Detect fresh DB by absence of any user table.
  const res = await pglite.query(
    "select 1 from information_schema.tables where table_schema='public' limit 1"
  );
  if (res.rows.length > 0) return;

  const dataDir = resolveBundledDataDir();
  const schemaPath = path.join(dataDir, 'schema.sql');
  const seedPath = path.join(dataDir, 'seed.sql');

  if (fs.existsSync(schemaPath)) {
    console.log('[PGlite] Applying schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    try {
      await pglite.exec(sql);
    } catch (err) {
      console.error('[PGlite] schema.sql error:', err.message);
    }
  }
  if (fs.existsSync(seedPath)) {
    console.log('[PGlite] Applying seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf-8');
    try {
      await pglite.exec(sql);
    } catch (err) {
      console.error('[PGlite] seed.sql error:', err.message);
    }
  }
}

async function getPglite() {
  if (pgliteInstance) return pgliteInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const userDir = resolveUserDataDir();
    await ensureSeeded(userDir);

    // PGlite is an ESM module; dynamic import from CJS.
    const { PGlite } = await import('@electric-sql/pglite');
    // Load extensions used by the schema (pgcrypto, pg_trgm).
    let extensions = {};
    try {
      const pgTrgm = await import('@electric-sql/pglite/contrib/pg_trgm');
      const pgcrypto = await import('@electric-sql/pglite/contrib/pgcrypto');
      extensions = { pg_trgm: pgTrgm.pg_trgm, pgcrypto: pgcrypto.pgcrypto };
    } catch (e) {
      console.warn('[PGlite] Optional extensions unavailable:', e.message);
    }

    console.log('[PGlite] Opening database at', userDir);
    pgliteInstance = await PGlite.create({
      dataDir: userDir,
      extensions,
    });

    await applySqlFilesIfFresh(pgliteInstance);
    console.log('[PGlite] Ready');
    return pgliteInstance;
  })();

  return initPromise;
}

function registerIpc() {
  ipcMain.handle('localdb:query', async (_evt, sql, params) => {
    const db = await getPglite();
    try {
      const res = await db.query(sql, params ?? []);
      return { ok: true, rows: res.rows, fields: res.fields };
    } catch (err) {
      return { ok: false, error: { message: err.message, code: err.code } };
    }
  });

  ipcMain.handle('localdb:exec', async (_evt, sql) => {
    const db = await getPglite();
    try {
      await db.exec(sql);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: { message: err.message, code: err.code } };
    }
  });

  ipcMain.handle('localdb:transaction', async (_evt, statements) => {
    const db = await getPglite();
    try {
      const results = [];
      await db.transaction(async (tx) => {
        for (const { sql, params } of statements) {
          const r = await tx.query(sql, params ?? []);
          results.push({ rows: r.rows });
        }
      });
      return { ok: true, results };
    } catch (err) {
      return { ok: false, error: { message: err.message, code: err.code } };
    }
  });

  // Eagerly warm the DB so first user query is fast.
  app.whenReady().then(() => {
    getPglite().catch((e) => console.error('[PGlite] Init failed:', e));
  });
}

module.exports = { registerIpc, getPglite };