import { afterEach,describe,expect,test } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { exportBackup,previewBackup,restoreBackup,BACKUP_TABLES } from '../src/lib/server/backup';
import { crc32,makeZip,readZip } from '../src/lib/server/backup-zip';

const scripts=['0001_initial.sql','0002_custom_categories.sql','0003_pantry_imports.sql','0004_shopping_pantry_transfers.sql'];
const folders:string[]=[];
afterEach(()=>{for(const dir of folders.splice(0))rmSync(dir,{recursive:true,force:true});});
function fixture(){
  const db=new Database(':memory:');
  db.pragma('foreign_keys=ON');
  db.exec('CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)');
  for(const name of scripts){
    db.exec(readFileSync(join('scripts','migrations',name),'utf8'));
    db.prepare('INSERT INTO schema_migrations(name,applied_at) VALUES(?,?)').run(name,1);
  }
  db.exec(`
    INSERT INTO categories(id,name_de,name_en,is_custom) VALUES('meat','Fleisch','Meat',1);
    INSERT INTO units VALUES('pack','Packung','Pack','count',1);
    INSERT INTO shopping_lists VALUES('default','Shopping',0,1);
    INSERT INTO pantry_locations VALUES('home','Home','Home');
    INSERT INTO products(id,category_id,name_de,source,created_at,updated_at) VALUES('salami','meat','Salami','custom',1,1);
    INSERT INTO product_variants(id,product_id,label_de) VALUES('plain','salami','Normal');
    INSERT INTO shopping_items(id,list_id,product_id,variant_id,name_snapshot,quantity,unit_id,created_at,updated_at)
       VALUES('purchase','default','salami','plain','Salami',2,'pack',1,1);
    INSERT INTO pantry_items(id,location_id,product_id,variant_id,name_snapshot,quantity,unit_id,created_at,updated_at)
       VALUES('stock','home','salami','plain','Salami',3,'pack',1,1);
    INSERT INTO pantry_imports(id,digest,item_count,created_at) VALUES('receipt','digest123',1,1);
    INSERT INTO shopping_pantry_transfers(shopping_item_id,pantry_item_id,quantity) VALUES('purchase','stock',2);
    INSERT INTO settings(key,value) VALUES('private-token','NEVER_EXPORT_THIS');
    INSERT INTO settings(key,value) VALUES('auth.password_hash','scrypt$TEST_ONLY');
    INSERT INTO sessions(token_hash,created_at,expires_at) VALUES('secret-session',1,99);
    INSERT INTO login_attempts(ip_key,attempts,window_start) VALUES('secret-ip',1,1);
    INSERT INTO change_events(topic,created_at) VALUES('pantry',1);
  `);
  return db;
}
const count=(db:Database.Database,table:string)=>(db.prepare(`SELECT COUNT(*) as n FROM "${table}"`).get() as {n:number}).n;
const temp=()=>{const dir=mkdtempSync(join(tmpdir(),'ssa-backup-test-'));folders.push(dir);return dir;};

describe('portable ZIP backup and restore',()=>{
  test('standard ZIP headers and crc roundtrip; only two safe entries',()=>{
    const zip=makeZip({'manifest.json':Buffer.from('{"test":1}'),'data.json':Buffer.from('abc')});
    expect(zip.subarray(0,2).toString()).toBe('PK');
    expect(readZip(zip)['data.json'].toString()).toBe('abc');
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    const tampered=Buffer.from(zip);tampered[40]^=1;
    expect(()=>readZip(tampered)).toThrow();
    const traversal=Buffer.from(zip);
    const start=traversal.indexOf('manifest.json');traversal.write('../private.txt',start,'ascii');
    expect(()=>readZip(traversal)).toThrow();
    const deflate=Buffer.from(zip);deflate.writeUInt16LE(8,8);
    expect(()=>readZip(deflate)).toThrow();
  });
  test('exports every household table but no sessions, credentials or server settings',()=>{
    const db=fixture();
    try{
      const file=exportBackup(db),entries=readZip(file.bytes);
      expect(file.filename).toMatch(/^smart-shopping-assistant-backup-\d{8}-\d{6}\.zip$/);
      const json=entries['data.json'].toString('utf8');
      expect(json).toContain('Salami');
      for(const forbidden of ['NEVER_EXPORT_THIS','secret-session','secret-ip','APP_PASSWORD_HASH','auth.password_hash','scrypt$'])expect(json).not.toContain(forbidden);
      const parsed=JSON.parse(json);
      expect(Object.keys(parsed.tables).sort()).toEqual([...BACKUP_TABLES].sort());
      const preview=previewBackup(db,file.bytes);
      expect(preview.rowCounts.shopping_items).toBe(1);
      expect(preview.rowCounts.shopping_pantry_transfers).toBe(1);
      expect(preview.schemaVersion).toBe('0004_shopping_pantry_transfers.sql');
      expect(preview.totalRecords).toBe(Object.values(preview.rowCounts).reduce((x,y)=>x+y,0));
    }finally{db.close();}
  });
  test('restore overwrites target atomically, saves pre-import file and preserves current login',()=>{
    const source=fixture(),target=fixture(),dir=temp();
    try{
      source.prepare("UPDATE pantry_items SET quantity=7 WHERE id='stock'").run();
      const exportFile=exportBackup(source);
      target.prepare("UPDATE pantry_items SET quantity=42 WHERE id='stock'").run();
      const result=restoreBackup(target,exportFile.bytes,dir);
      expect(result.importedRecords).toBeGreaterThan(1);
      expect(result.rowCounts.products).toBe(1);
      expect(count(target,'products')).toBe(1);
      expect((target.prepare("SELECT quantity FROM pantry_items WHERE id='stock'").get() as {quantity:number}).quantity).toBe(7);
      expect(count(target,'sessions')).toBe(1);
      expect(count(target,'login_attempts')).toBe(1);
      expect((target.prepare("SELECT value FROM settings WHERE key='private-token'").get() as {value:string}).value).toBe('NEVER_EXPORT_THIS');
      expect((target.prepare("SELECT value FROM settings WHERE key='auth.password_hash'").get() as {value:string}).value).toBe('scrypt$TEST_ONLY');
      const file=join(dir,result.safetyBackup);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).mode&0o777).toBe(0o600);
      const backup=previewBackup(target,readFileSync(file));
      expect(backup.totalRecords).toBe(result.importedRecords);
      expect(JSON.stringify(JSON.parse(readZip(readFileSync(file))['data.json'].toString()))).toContain('"quantity":42');
      expect((target.pragma('foreign_key_check') as unknown[])).toHaveLength(0);
    }finally{source.close();target.close();}
  });
  test('invalid row references rollback fully; damaged bytes fail before safety backup',()=>{
    const db=fixture(),dir=temp();
    try{
      const file=exportBackup(db),files=readZip(file.bytes);
      const data=JSON.parse(files['data.json'].toString('utf8'));
      data.tables.pantry_items[0].product_id='nonexistent-product';
      const dataBytes=Buffer.from(JSON.stringify(data));
      const manifest=JSON.parse(files['manifest.json'].toString('utf8'));
      manifest.dataSha256=createHash('sha256').update(dataBytes).digest('hex');
      const forged=makeZip({'data.json':dataBytes,'manifest.json':Buffer.from(JSON.stringify(manifest))});
      expect(()=>previewBackup(db,forged)).toThrow();
      expect(()=>restoreBackup(db,forged,dir)).toThrow();
      expect(count(db,'products')).toBe(1);
      expect((db.prepare("SELECT product_id FROM pantry_items").get() as {product_id:string}).product_id).toBe('salami');
      const pre=readdirSync(dir).length;
      const broken=Buffer.from(file.bytes);broken[42]^=17;
      expect(()=>previewBackup(db,broken)).toThrow();
      expect(()=>restoreBackup(db,broken,dir)).toThrow();
      expect(readdirSync(dir)).toHaveLength(pre);
    }finally{db.close();}
  });
  test('backup directory write failure rejects restore and keeps records',()=>{
    const db=fixture(),dir=temp();
    try{
      const file=join(dir,'not-a-folder');writeFileSync(file,'no');
      const original=exportBackup(db).bytes;
      expect(()=>restoreBackup(db,original,file)).toThrow();
      expect(count(db,'shopping_items')).toBe(1);
      expect((db.prepare("SELECT quantity FROM pantry_items").get() as {quantity:number}).quantity).toBe(3);
    }finally{db.close();}
  });
  test('schema/version mismatch, unexpected table and incorrect checksums are rejected',()=>{
    const db=fixture();
    try{
      const original=readZip(exportBackup(db).bytes);
      const manifest=JSON.parse(original['manifest.json'].toString('utf8'));
      manifest.schemaMigrations=['wrong.sql'];manifest.schemaVersion='wrong.sql';
      expect(()=>previewBackup(db,makeZip({'manifest.json':Buffer.from(JSON.stringify(manifest)),'data.json':original['data.json']}))).toThrow(/schema/i);
      manifest.schemaMigrations=scripts;manifest.schemaVersion=scripts.at(-1);
      manifest.appVersion='999.1.0';
      expect(()=>previewBackup(db,makeZip({'manifest.json':Buffer.from(JSON.stringify(manifest)),'data.json':original['data.json']}))).toThrow(/version/i);
      manifest.appVersion='1.0.6';manifest.dataSha256='0'.repeat(64);
      expect(()=>previewBackup(db,makeZip({'manifest.json':Buffer.from(JSON.stringify(manifest)),'data.json':original['data.json']}))).toThrow(/checksum/i);
    }finally{db.close();}
  });
});
