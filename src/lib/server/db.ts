import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { seedCatalog } from './seed';

let instance: Database.Database | undefined;

export function database(): Database.Database {
  if (instance) return instance;
  const path = process.env.DATABASE_PATH || './data/shopping.db';
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  // Only a genuinely new database may accept a first-run web setup.
  db.transaction(() => {
  const fresh = !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1").get();
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const dir = join(process.cwd(), 'scripts', 'migrations');
  for (const name of readdirSync(dir).filter((item) => item.endsWith('.sql')).sort()) {
    const found = db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(name);
    if (found) continue;
    const sql = readFileSync(join(dir, name), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)').run(name, Date.now());
    })();
  }
  seedCatalog(db);
  if (fresh) db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('auth.setup_allowed','1');
  }).immediate();
  instance = db;
  return db;
}
export function orm() { return drizzle(database()); }
export function now() { return Date.now(); }
