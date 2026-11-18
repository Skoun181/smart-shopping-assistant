import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { database, now } from './db';

const SESSION_COOKIE = 'shopping_session';
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

export function checkPassword(password: string): boolean {
  const encoded = process.env.APP_PASSWORD_HASH ?? '';
  const parts = encoded.split('$');
  if (parts.length !== 5 || parts[0] !== 'scrypt') throw new Error('APP_PASSWORD_HASH is missing or malformed');
  const [, nString, rString, pString, saltDigest] = parts;
  // Encoded form: scrypt$N$r$p$salt_base64:digest_base64
  const [salt, digest] = saltDigest.split(':');
  const n = Number(nString), r = Number(rString), p = Number(pString);
  if (n !== 32768 || r !== 8 || p !== 1 || !salt || !digest) throw new Error('Unsupported password hash parameters');
  const expected = Buffer.from(digest, 'base64');
  if (expected.length !== 32) throw new Error('Invalid password hash');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), 32, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(actual, expected);
}
export function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function secureCookies(): boolean { return (process.env.ORIGIN ?? '').startsWith('https://'); }
export function newSession(cookies: Cookies): void {
  const raw = randomBytes(32).toString('base64url');
  const db = database();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  db.prepare('INSERT INTO sessions(token_hash,created_at,expires_at) VALUES(?,?,?)').run(tokenDigest(raw),now(),now() + SESSION_MS);
  cookies.set(SESSION_COOKIE, raw, { path: '/', httpOnly: true, sameSite: 'lax', secure: secureCookies(), maxAge: SESSION_MS / 1000 });
}
export function getSession(cookies: Cookies): string | null {
  const raw = cookies.get(SESSION_COOKIE);
  if (!raw || !/^[A-Za-z0-9_-]{40,64}$/.test(raw)) return null;
  const digest = tokenDigest(raw);
  const found = database().prepare('SELECT token_hash FROM sessions WHERE token_hash = ? AND expires_at > ?').get(digest, now());
  return found ? digest : null;
}
export function deleteSession(cookies: Cookies): void {
  const raw = cookies.get(SESSION_COOKIE);
  if (raw) database().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenDigest(raw));
  cookies.delete(SESSION_COOKIE,{ path:'/', secure:secureCookies(), sameSite:'lax', httpOnly:true });
}
function ipDigest(ip: string): string {
  return createHash('sha256').update('shopping-login-ip:' + ip).digest('hex');
}
export function loginAllowed(ip: string): boolean {
  const key = ipDigest(ip);
  const row = database().prepare('SELECT attempts,window_start,locked_until FROM login_attempts WHERE ip_key=?').get(key) as { attempts:number; window_start:number; locked_until:number } | undefined;
  return !row || (row.locked_until <= now() && (row.window_start + WINDOW_MS < now() || row.attempts < 5));
}
export function registerFailure(ip: string): void {
  const key = ipDigest(ip), db = database(), t=now();
  const row = db.prepare('SELECT attempts,window_start FROM login_attempts WHERE ip_key=?').get(key) as { attempts:number;window_start:number } | undefined;
  const reset = !row || row.window_start + WINDOW_MS < t;
  const attempts = reset ? 1 : row.attempts + 1;
  db.prepare('INSERT INTO login_attempts(ip_key,attempts,window_start,locked_until) VALUES(?,?,?,?) ON CONFLICT(ip_key) DO UPDATE SET attempts=excluded.attempts,window_start=excluded.window_start,locked_until=excluded.locked_until').run(key,attempts,reset ? t : row!.window_start, attempts >= 5 ? t+WINDOW_MS : 0);
}
export function clearFailures(ip: string): void {
  database().prepare('DELETE FROM login_attempts WHERE ip_key=?').run(ipDigest(ip));
}
