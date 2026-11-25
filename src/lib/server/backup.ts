import Database from 'better-sqlite3';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { readFileSync } from 'node:fs';
import { MAX_ARCHIVE_BYTES, makeZip, readZip } from './backup-zip';

type Value=string|number|null;
type Row=Record<string,Value>;
type Dataset={tables:Record<string,Row[]>};
type Manifest={
  format:'smart-shopping-assistant-backup';formatVersion:1;
  createdAt:string;appVersion:string;schemaVersion:string;
  schemaMigrations:string[];rowCounts:Record<string,number>;
  dataSha256:string;contents:string[];
};
export const BACKUP_TABLES=[
  'categories','units','shopping_lists','pantry_locations','products',
  'product_variants','shopping_items','pantry_items','pantry_imports',
  'shopping_pantry_transfers'
] as const;
const OMITTED=['schema_migrations','sessions','login_attempts','change_events','settings','shopping_operations'];
const MAX_DATA_BYTES=24*1024*1024;
const MAX_ROWS=100000;
const SAFETY_BACKUP_RETENTION=5;
const TECHNICAL_MIGRATIONS=new Set(['0005_shopping_operations.sql']);
function fail(message:string):never{throw new Error(message);}
function appVersion():string{
  const value=JSON.parse(readFileSync(join(process.cwd(),'package.json'),'utf8')).version as unknown;
  if(typeof value!=='string'||!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(value))return fail('Invalid application version');
  return value;
}
export function schemaMigrations(db:Database.Database):string[]{
  return (db.prepare('SELECT name FROM schema_migrations ORDER BY name').all() as {name:string}[]).map(x=>x.name).filter(name=>!TECHNICAL_MIGRATIONS.has(name));
}
function columns(db:Database.Database,table:string):string[]{
  if(!BACKUP_TABLES.includes(table as (typeof BACKUP_TABLES)[number]))return fail('Unsupported table');
  const c=db.pragma(`table_info("${table}")`) as {name:string}[];
  if(!c.length||c.some(x=>!/^[a-z_][a-z0-9_]*$/i.test(x.name)))return fail('Invalid database schema');
  return c.map(x=>x.name);
}
function schemaGuard(db:Database.Database):void{
  const tables=(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name:string}[]).map(t=>t.name);
  for(const table of tables)if(!BACKUP_TABLES.includes(table as (typeof BACKUP_TABLES)[number])&&!OMITTED.includes(table))return fail('Database has newer or unsupported tables');
  for(const table of BACKUP_TABLES)if(!tables.includes(table))return fail('Database is missing a required table');
}
function capture(db:Database.Database):Dataset{
  schemaGuard(db);
  const tables:Record<string,Row[]>={};
  for(const table of BACKUP_TABLES){
    const result=db.prepare(`SELECT * FROM "${table}"`).all() as Row[];
    tables[table]=result;
  }
  return {tables};
}
function countRows(data:Dataset):Record<string,number>{
  return Object.fromEntries(BACKUP_TABLES.map(t=>[t,data.tables[t].length]));
}
function archiveFor(db:Database.Database,data:Dataset):Buffer{
  const rowCounts=countRows(data);
  if(Object.values(rowCounts).reduce((sum,count)=>sum+count,0)>MAX_ROWS)fail('Backup exceeds record limit');
  const body=Buffer.from(JSON.stringify(data),'utf8');
  if(body.length>MAX_DATA_BYTES)return fail('Backup data exceeds 24 MiB');
  const migrations=schemaMigrations(db);
  const manifest:Manifest={
    format:'smart-shopping-assistant-backup',formatVersion:1,
    createdAt:new Date().toISOString(),appVersion:appVersion(),
    schemaVersion:migrations.at(-1)??'none',schemaMigrations:migrations,
    rowCounts,dataSha256:createHash('sha256').update(body).digest('hex'),
    contents:['manifest.json','data.json']
  };
  return makeZip({'manifest.json':Buffer.from(JSON.stringify(manifest),'utf8'),'data.json':body});
}
export function exportBackup(db:Database.Database):{bytes:Buffer;filename:string;rowCounts:Record<string,number>}{
  return db.transaction(()=>{
    const data=capture(db);
    const bytes=archiveFor(db,data);
    const timestamp=new Date().toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15);
    return {bytes,filename:`smart-shopping-assistant-backup-${timestamp}.zip`,rowCounts:countRows(data)};
  })();
}
function isObject(value:unknown):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null&&!Array.isArray(value);
}
function numberVersion(v:string):number[]|null{
  if(!/^\d+\.\d+\.\d+$/.test(v))return null;
  const parts=v.split('.').map(Number);
  return parts.every(Number.isSafeInteger)?parts:null;
}
function validatePayload(db:Database.Database,archive:Buffer):{manifest:Manifest;data:Dataset;total:number}{
  if(archive.length>MAX_ARCHIVE_BYTES)fail('Backup is too large (max 32 MiB)');
  const files=readZip(archive);
  let parsed:unknown,document:unknown;
  try{
    parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files['manifest.json']));
    document=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files['data.json']));
  }catch{return fail('Backup contains invalid JSON');}
  if(!isObject(parsed)||parsed.format!=='smart-shopping-assistant-backup'||parsed.formatVersion!==1||
    typeof parsed.createdAt!=='string'||!Number.isFinite(Date.parse(parsed.createdAt))||
    typeof parsed.appVersion!=='string'||typeof parsed.schemaVersion!=='string'||
    typeof parsed.dataSha256!=='string'||!/^[a-f0-9]{64}$/.test(parsed.dataSha256)||
    !Array.isArray(parsed.schemaMigrations)||!parsed.schemaMigrations.every(x=>typeof x==='string')||
    !Array.isArray(parsed.contents)||parsed.contents.join(',')!=='manifest.json,data.json'||
    !isObject(parsed.rowCounts))fail('Invalid backup manifest');
  const manifest=parsed as unknown as Manifest;
  const actual=createHash('sha256').update(files['data.json']).digest('hex');
  if(actual!==manifest.dataSha256)fail('Backup checksum does not match');
  const current=schemaMigrations(db);
  if(manifest.schemaMigrations.join('\n')!==current.join('\n')||
     manifest.schemaVersion!==(current.at(-1)??'none'))fail('Database schema differs: install a compatible app version first');
  const source=numberVersion(manifest.appVersion),target=numberVersion(appVersion().split('-')[0]);
  if(!source||!target||source[0]!==target[0]||
     source.some((v,i)=>v>target[i]&&source.slice(0,i).every((x,j)=>x===target[j])))
    fail('Backup was created by an incompatible or newer app version');
  schemaGuard(db);
  if(!isObject(document)||!isObject(document.tables))fail('Invalid backup data');
  if(Object.keys(document.tables).sort().join('|')!==[...BACKUP_TABLES].sort().join('|'))fail('Unexpected backup tables');
  let total=0;
  for(const table of BACKUP_TABLES){
    const rows=document.tables[table],names=columns(db,table);
    if(!Array.isArray(rows)||!Number.isSafeInteger(manifest.rowCounts[table])||
       manifest.rowCounts[table]!==rows.length)fail('Backup row counts do not match');
    total+=rows.length;if(total>MAX_ROWS)fail('Backup contains too many records');
    for(const row of rows){
      if(!isObject(row)||Object.keys(row).sort().join('|')!==[...names].sort().join('|'))fail('Backup columns do not match the database');
      for(const field of names){
        const value=row[field];
        if(value!==null&&typeof value!=='string'&&!(typeof value==='number'&&Number.isFinite(value)))fail('Unsupported value in backup');
      }
    }
  }
  if(Object.keys(manifest.rowCounts).sort().join('|')!==[...BACKUP_TABLES].sort().join('|'))fail('Invalid backup row counts');
  return {manifest,data:document as unknown as Dataset,total};
}
function insertDataset(db:Database.Database,data:Dataset):void {
  for(const table of BACKUP_TABLES){
    const fields=columns(db,table);
    const statement=db.prepare(`INSERT INTO "${table}" (${fields.map(x=>`"${x}"`).join(',')}) VALUES (${fields.map(()=>'?').join(',')})`);
    for(const row of data.tables[table])statement.run(...fields.map(x=>row[x]));
  }
  if((db.pragma('foreign_key_check') as unknown[]).length)fail('Backup violates database references');
}

export function previewBackup(db:Database.Database,archive:Buffer){
  const {manifest,data,total}=validatePayload(db,archive);
  const staging = new Database(':memory:');
  try {
    const definitions = db.prepare("SELECT tbl_name,sql FROM sqlite_schema WHERE type IN ('table','index') AND sql IS NOT NULL ORDER BY type DESC").all() as {tbl_name:string;sql:string}[];
    for (const {tbl_name,sql} of definitions)
      if (BACKUP_TABLES.includes(tbl_name as (typeof BACKUP_TABLES)[number])) staging.exec(sql);
    staging.pragma('foreign_keys=ON');
    staging.transaction(()=>insertDataset(staging,data))();
  } finally { staging.close(); }
  return {createdAt:manifest.createdAt,appVersion:manifest.appVersion,
    schemaVersion:manifest.schemaVersion,rowCounts:manifest.rowCounts,totalRecords:total};
}
export function restoreBackup(db:Database.Database,archive:Buffer,backupDirectory?:string){
  const {manifest,data,total}=validatePayload(db,archive);
  const dbPath=process.env.DATABASE_PATH||'./data/shopping.db';
  const folder=backupDirectory??join(dirname(dbPath===':memory:'?'./data/shopping.db':dbPath),'backups');
  let safetyName='';
  // Immediate transaction blocks other SQLite writers. The safety ZIP is produced
  // from this exact pre-import snapshot, before the first destructive statement.
  db.transaction(()=>{
    const previous=capture(db),safety=archiveFor(db,previous);
    mkdirSync(folder,{recursive:true,mode:0o700});
    safetyName=`pre-import-${new Date().toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15)}-${randomBytes(4).toString('hex')}.zip`;
    writeFileSync(join(folder,safetyName),safety,{flag:'wx',mode:0o600,flush:true});
    for(const table of [...BACKUP_TABLES].reverse())db.prepare(`DELETE FROM "${table}"`).run();
    insertDataset(db,data);
    if (db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='shopping_operations'").get())
      db.prepare('DELETE FROM shopping_operations').run();
  }).immediate();
  try {
    const saved=readdirSync(folder,{withFileTypes:true})
      .filter(file=>file.isFile()&&/^pre-import-\d{8}-\d{6}-[a-f0-9]{8}\.zip$/.test(file.name)&&file.name!==safetyName)
      .map(file=>({name:file.name,modified:statSync(join(folder,file.name)).mtimeMs}))
      .sort((a,b)=>b.modified-a.modified);
    for(const {name} of saved.slice(SAFETY_BACKUP_RETENTION-1))unlinkSync(join(folder,name));
  } catch (cause) { console.warn('[backup] retention cleanup failed', (cause as Error).name); }
  // Technical tables (sessions, rate-limits, event log, settings and migration
  // bookkeeping) are intentionally not restored or exported.
  return {createdAt:manifest.createdAt,importedRecords:total,rowCounts:countRows(data),safetyBackup:basename(safetyName)};
}
