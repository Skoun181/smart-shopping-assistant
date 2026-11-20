import type { RequestHandler } from './$types';
import { database } from '#lib/server/db.ts';
import { restoreBackup } from '#lib/server/backup.ts';
import { readBackupUpload, backupError } from '#lib/server/backup-upload.ts';
import { changed } from '#lib/server/events.ts';
import { response } from '#lib/server/http.ts';

let busy=false;
export const POST:RequestHandler=async(event)=>{
  if(busy)return response({error:'Eine Wiederherstellung läuft bereits.'},409);
  busy=true;
  try{
    const bytes=await readBackupUpload(event);
    const result=restoreBackup(database(),bytes);
    // The restore has committed. Best effort: notify already connected browsers.
    for(const topic of ['catalog','shopping','pantry'] as const){
      try{changed(topic);}catch{console.error('[backup] realtime notification failed');}
    }
    console.info('[backup] restore completed',result.importedRecords,'records; safety archive created');
    return response({ok:true,...result});
  }catch(cause){
    // Preserve framework HTTP status for rejected uploads.
    if(typeof cause==='object'&&cause!==null&&'status' in cause&&
       typeof cause.status==='number'&&cause.status>=400&&cause.status<500)throw cause;
    const result=backupError(cause,'restore');
    return response({error:result.error},result.status);
  }finally{busy=false;}
};
