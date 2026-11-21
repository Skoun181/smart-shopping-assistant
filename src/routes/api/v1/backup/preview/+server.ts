import type { RequestHandler } from './$types';
import { database } from '#lib/server/db.ts';
import { previewBackup } from '#lib/server/backup.ts';
import { readBackupUpload, backupError } from '#lib/server/backup-upload.ts';
import { response } from '#lib/server/http.ts';

export const POST:RequestHandler=async(event)=>{
  const bytes=await readBackupUpload(event);
  try{
    return response({ok:true,...previewBackup(database(),bytes)});
  }catch(cause){
    const result=backupError(cause,'preview');
    return response({error:result.error},result.status);
  }
};
