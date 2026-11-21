import type Database from 'better-sqlite3';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const PASSWORD_KEY = 'auth.password_hash';
export const SETUP_KEY = 'auth.setup_allowed';
export type LoginState = 'setup' | 'ready' | 'locked';
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function readSetting(db: Database.Database, key: string): string | undefined {
  return (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as {value:string}|undefined)?.value;
}
function decode(encoded: string) {
  const match = /^scrypt\$32768\$8\$1\$([A-Za-z0-9+/]{22}==):([A-Za-z0-9+/]{43}=)$/.exec(encoded);
  if (!match) return null;
  const salt = Buffer.from(match[1], 'base64'), digest = Buffer.from(match[2], 'base64');
  if (salt.length !== 16 || digest.length !== 32 || salt.toString('base64') !== match[1] || digest.toString('base64') !== match[2]) return null;
  return {salt,digest};
}
function storeCredential(db: Database.Database, encoded: string) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(PASSWORD_KEY,encoded);
  db.prepare('DELETE FROM settings WHERE key=?').run(SETUP_KEY);
  // Revoke old sessions and stale IP locks whenever a credential is installed.
  db.prepare('DELETE FROM sessions').run();
  db.prepare('DELETE FROM login_attempts').run();
}
export function loginState(db: Database.Database, legacy = ''): LoginState {
  const stored = readSetting(db,PASSWORD_KEY);
  if (stored !== undefined) return decode(stored) ? 'ready' : 'locked';
  // Migrate a valid old environment hash only once, without printing it.
  if (decode(legacy)) {
    return db.transaction(():LoginState => {
      const current=readSetting(db,PASSWORD_KEY);
      if(current!==undefined)return decode(current)?'ready':'locked';
      storeCredential(db,legacy);
      return 'ready';
    }).immediate();
  }
  return readSetting(db,SETUP_KEY)==='1'?'setup':'locked';
}
export function passwordValid(password: string): boolean {
  return password.length>=12 && Buffer.byteLength(password,'utf8')<=1024;
}
export function createPassword(db:Database.Database,password:string,legacy=''):boolean {
  if(!passwordValid(password))return false;
  return db.transaction(()=>{
    if(loginState(db,legacy)!=='setup')return false;
    const salt=randomBytes(16);
    const digest=scryptSync(password,salt,32,options);
    storeCredential(db,'scrypt$32768$8$1$'+salt.toString('base64')+':'+digest.toString('base64'));
    return true;
  }).immediate();
}
export function verifyPassword(db:Database.Database,password:string,legacy=''):boolean {
  if(Buffer.byteLength(password,'utf8')>1024||loginState(db,legacy)!=='ready')return false;
  const encoded=readSetting(db,PASSWORD_KEY);
  const parsed=encoded?decode(encoded):null;
  if(!parsed)return false;
  const actual=scryptSync(password,parsed.salt,32,options);
  return timingSafeEqual(actual,parsed.digest);
}
