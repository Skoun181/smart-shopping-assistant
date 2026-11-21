import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { database, now } from './db';
import { loginState, createPassword, verifyPassword } from './credentials';

const SESSION_COOKIE = 'shopping_session';
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

export function credentialState() { return loginState(database(),process.env.APP_PASSWORD_HASH??''); }
export function setupPassword(password:string):boolean { return createPassword(database(),password,process.env.APP_PASSWORD_HASH??''); }
export function checkPassword(password:string):boolean {return verifyPassword(database(),password,process.env.APP_PASSWORD_HASH??'');}
export function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function cookieName(secure: boolean): string { return secure ? '__Host-shopping_session' : SESSION_COOKIE; }
export function newSession(cookies: Cookies, secure: boolean): void {
  const raw = randomBytes(32).toString('base64url');
  const db = database();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  db.prepare('INSERT INTO sessions(token_hash,created_at,expires_at) VALUES(?,?,?)').run(tokenDigest(raw),now(),now() + SESSION_MS);
  cookies.set(cookieName(secure), raw, { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: SESSION_MS / 1000 });
}
export function getSession(cookies: Cookies, secure: boolean): string | null {
  if (credentialState()!=='ready') return null;
  const raw = cookies.get(cookieName(secure));
  if (!raw || !/^[A-Za-z0-9_-]{40,64}$/.test(raw)) return null;
  const digest = tokenDigest(raw);
  const found = database().prepare('SELECT token_hash FROM sessions WHERE token_hash = ? AND expires_at > ?').get(digest, now());
  return found ? digest : null;
}
export function deleteSession(cookies: Cookies, secure: boolean): void {
  const raw = cookies.get(cookieName(secure));
  if (raw) database().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenDigest(raw));
  cookies.delete(cookieName(secure),{ path:'/', secure, sameSite:'lax', httpOnly:true });
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
