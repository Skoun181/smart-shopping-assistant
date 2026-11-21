import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
const path=process.env.DATABASE_PATH||'./data/shopping.db';
if(process.argv.length!==3||process.argv[2]!=='--allow-setup'){
  console.error('Usage: node scripts/reset-login.mjs --allow-setup');
  console.error('Restrict network access first. This revokes every session and opens the one-time Create Login page.');
  process.exit(1);
}
if(process.env.APP_PASSWORD_HASH){
  console.error('Remove the legacy APP_PASSWORD_HASH from the container and recreate it first.');
  process.exit(1);
}
if(!existsSync(path)||path===':memory:'){console.error('Existing database not found.');process.exit(1);}
const db=new Database(path,{fileMustExist:true});
db.pragma('busy_timeout=5000');
try{
  db.transaction(()=>{
    db.prepare("DELETE FROM settings WHERE key='auth.password_hash'").run();
    db.prepare("INSERT INTO settings(key,value) VALUES('auth.setup_allowed','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
    db.prepare('DELETE FROM sessions').run();
    db.prepare('DELETE FROM login_attempts').run();
  }).immediate();
  console.log('One-time Create Login enabled. Open the app immediately in a trusted network.');
}finally{db.close();}
