import type { RequestHandler } from './$types';
import { database } from '#lib/server/db.ts';
import { exportBackup } from '#lib/server/backup.ts';
import { response } from '#lib/server/http.ts';

export const GET:RequestHandler=()=>{
  try{
    const {bytes,filename,rowCounts}=exportBackup(database());
    console.info('[backup] exported',Object.values(rowCounts).reduce((a,b)=>a+b,0),'records');
    return new Response(new Uint8Array(bytes),{
      status:200,
      headers:{
        'Content-Type':'application/zip',
        'Content-Disposition':`attachment; filename="${filename}"`,
        'Content-Length':String(bytes.length),
        'Cache-Control':'private, no-store',
        'X-Content-Type-Options':'nosniff'
      }
    });
  }catch(cause){
    console.error('[backup] export failed:',cause instanceof Error?cause.name:'UnknownError');
    if(cause instanceof Error && /exceeds|too large/i.test(cause.message))
      return response({error:'Das Backup überschreitet die Größenbegrenzung (24 MiB Daten / 32 MiB ZIP).'},413);
    return response({error:'Export fehlgeschlagen. Bitte Server-Logs prüfen.'},500);
  }
};
