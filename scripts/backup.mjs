import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = process.env.DATABASE_PATH || './data/shopping.db';
const destination = resolve(process.argv[2] || './data/backups/shopping-' + new Date().toISOString().replace(/[:.]/g,'-') + '.db');
mkdirSync(dirname(destination),{recursive:true});
const db = new Database(source,{readonly:true,fileMustExist:true});
await db.backup(destination);
db.close();
console.log('Backup created: ' + destination);
