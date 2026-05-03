import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { normalizeSpaces } from '../../utils/format.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = resolve(__dirname, '../../../data/automation.sqlite');

let db;

export function findCachedUstockStock(query) {
  const key = normalizeStockCacheKey(query);

  if (!key) {
    return null;
  }

  const row = getDatabase()
    .prepare(`
      SELECT display_name, normalized_name, code, url, resolved_at
      FROM ustock_stocks
      WHERE normalized_name = ? OR code = ?
      ORDER BY resolved_at DESC
      LIMIT 1
    `)
    .get(key, key);

  if (!row) {
    return null;
  }

  return {
    stockName: row.display_name,
    normalizedName: row.normalized_name,
    code: row.code || '',
    url: row.url,
    resolvedAt: row.resolved_at
  };
}

export function saveCachedUstockStock(stock) {
  const normalizedName = normalizeStockCacheKey(stock.stockName);

  if (!normalizedName || !stock.url) {
    return;
  }

  const now = new Date().toISOString();

  getDatabase()
    .prepare(`
      INSERT INTO ustock_stocks (
        normalized_name,
        display_name,
        code,
        url,
        resolved_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(normalized_name) DO UPDATE SET
        display_name = excluded.display_name,
        code = excluded.code,
        url = excluded.url,
        resolved_at = excluded.resolved_at,
        updated_at = excluded.updated_at
    `)
    .run(
      normalizedName,
      stock.stockName,
      stock.code || '',
      stock.url,
      now,
      now
    );
}

export function normalizeStockCacheKey(value) {
  return normalizeSpaces(value).replace(/\s+IPO$/, '').trim();
}

function getDatabase() {
  if (db) {
    return db;
  }

  const dbPath = process.env.AUTOMATION_DB_PATH || DEFAULT_DB_PATH;
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS ustock_stocks (
      normalized_name TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      code TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      resolved_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ustock_stocks_code
    ON ustock_stocks(code);
  `);

  return db;
}

