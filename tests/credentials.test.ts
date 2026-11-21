import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createPassword, loginState, verifyPassword, PASSWORD_KEY, SETUP_KEY } from '../src/lib/server/credentials';
import { scryptSync, randomBytes } from 'node:crypto';
function fixture(fresh=false){
  const db=new Database(':memory:');
  db.exec('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY);CREATE TABLE login_attempts(ip_key TEXT PRIMARY KEY);');
  if(fresh)db.prepare('INSERT INTO settings VALUES(?,?)').run(SETUP_KEY,'1');
  return db;
}
const password='test-password-long-123';
function oldHash(){
  const salt=randomBytes(16);
  const digest=scryptSync(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return 'scrypt$32768$8$1$'+salt.toString('base64')+':'+digest.toString('base64');
}
describe('persistent shared login',()=>{
  it('creates exactly once and stores only a hash',()=>{
    const db=fixture(true);
    try{
      expect(loginState(db)).toBe('setup');
      expect(createPassword(db,'short')).toBe(false);
      expect(createPassword(db,password)).toBe(true);
      expect(loginState(db)).toBe('ready');
      expect(createPassword(db,'another-password-long')).toBe(false);
      expect(verifyPassword(db,password)).toBe(true);
      expect(verifyPassword(db,'incorrect')).toBe(false);
      const stored=(db.prepare('SELECT value FROM settings WHERE key=?').get(PASSWORD_KEY) as {value:string}).value;
      expect(stored).toMatch(/^scrypt\$/);expect(stored).not.toContain(password);
      expect(db.prepare('SELECT value FROM settings WHERE key=?').get(SETUP_KEY)).toBeUndefined();
    }finally{db.close();}
  });
  it('migrates a valid legacy hash without requiring env thereafter',()=>{
    const db=fixture();
    try{
      db.exec("INSERT INTO sessions VALUES('old');INSERT INTO login_attempts VALUES('old')");
      const legacy=oldHash();
      expect(loginState(db,legacy)).toBe('ready');
      expect(verifyPassword(db,password)).toBe(true);
      expect(createPassword(db,'another-password-long')).toBe(false);
      expect(db.prepare('SELECT * FROM sessions').all()).toHaveLength(0);
      expect(db.prepare('SELECT * FROM login_attempts').all()).toHaveLength(0);
    }finally{db.close();}
  });
  it('fails closed for existing databases when legacy hash is missing or damaged',()=>{
    const db=fixture();
    try{
      expect(loginState(db,'damaged')).toBe('locked');
      expect(createPassword(db,password)).toBe(false);
      expect(verifyPassword(db,password)).toBe(false);
    }finally{db.close();}
  });
});
