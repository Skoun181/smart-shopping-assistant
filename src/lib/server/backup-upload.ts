import { error, type RequestEvent } from '@sveltejs/kit';
import { MAX_ARCHIVE_BYTES } from './backup-zip';

export async function readBackupUpload(event:RequestEvent):Promise<Buffer>{
  const contentType=event.request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if(contentType!=='application/zip'&&contentType!=='application/x-zip-compressed')throw error(415,'ZIP file required');
  const length=event.request.headers.get('content-length');
  if(length!==null&&(Number.isNaN(Number(length))||Number(length)>MAX_ARCHIVE_BYTES))throw error(413,'Backup exceeds 32 MiB');
  const reader=event.request.body?.getReader();
  if(!reader)throw error(400,'Missing backup');
  const chunks:Uint8Array[]=[];let total=0;
  while(true){
    const part=await reader.read();
    if(part.done)break;
    total+=part.value.byteLength;
    if(total>MAX_ARCHIVE_BYTES){await reader.cancel();throw error(413,'Backup exceeds 32 MiB');}
    chunks.push(part.value);
  }
  if(total===0)throw error(400,'Empty backup');
  return Buffer.concat(chunks,total);
}
export function backupError(cause:unknown,operation:'preview'|'restore'){
  const msg=cause instanceof Error?cause.message:'Unexpected error';
  console.error('[backup]',operation,'failed:',cause instanceof Error?cause.name:'UnknownError');
  if(msg.includes('too large')||msg.includes('exceeds'))return {error:'Backup-Datei ist zu groß (maximal 32 MiB).',status:413};
  if(/schema|version|newer|compatible/i.test(msg))return {error:'Dieses Backup passt nicht zur installierten App-/Datenbank-Version. Verwende eine kompatible Version.',status:409};
  if(/SQLITE_BUSY|readonly|EACCES|ENOSPC|EROFS|SQLITE_FULL/i.test(msg))return {error:'Datenbank oder Sicherheits-Backup ist nicht beschreibbar. Server-Logs prüfen.',status:503};
  return {error:operation==='restore'?'Import abgebrochen. Vorhandene Daten wurden nicht verändert. Bitte ZIP prüfen.':'Ungültige oder beschädigte Backup-ZIP. Bitte Datei überprüfen.',status:422};
}
