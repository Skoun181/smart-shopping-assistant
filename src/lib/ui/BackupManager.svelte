<script lang="ts">
  export let lang:'de'|'en'='de';
  export let onRestored:()=>Promise<void>;
  type Preview={createdAt:string;appVersion:string;schemaVersion:string;totalRecords:number;rowCounts:Record<string,number>};
  let file:File|null=null;
  let preview:Preview|null=null;
  let exporting=false,validating=false,restoring=false;
  let message='',error='';
  const tr=(de:string,en:string)=>lang==='de'?de:en;
  const sizeLimit=32*1024*1024;
  function selected(event:Event){
    const input=event.currentTarget as HTMLInputElement;
    file=input.files?.[0]??null;
    preview=null;message='';error='';
    if(file&&file.size>sizeLimit){error=tr('ZIP darf höchstens 32 MiB groß sein.','ZIP must be 32 MiB or less.');file=null;}
  }
  async function upload(path:string){
    if(!file)throw new Error(tr('Bitte eine ZIP-Datei auswählen.','Please select a ZIP file.'));
    const res=await fetch('/api/v1/backup/'+path,{
      method:'POST',headers:{'Content-Type':'application/zip'},body:file
    });
    if(res.status===401){location.href='/login';throw new Error('Session expired');}
    const data=await res.json().catch(()=>({error:'HTTP '+res.status}));
    if(!res.ok)throw new Error(data.error||'HTTP '+res.status);
    return data;
  }
  async function exportNow(){
    if(exporting||restoring)return;
    exporting=true;error='';message='';
    try{
      const res=await fetch('/api/v1/backup',{cache:'no-store'});
      if(res.status===401){location.href='/login';return;}
      if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||'HTTP '+res.status);}
      const content=res.headers.get('content-disposition')??'';
      const filename=content.match(/filename="([^"]+)"/)?.[1]||'smart-shopping-assistant-backup.zip';
      const blob=await res.blob();
      const url=URL.createObjectURL(blob),anchor=document.createElement('a');
      anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),10000);
      message=tr('Backup erstellt. Speichere die ZIP-Datei an einem sicheren Ort.','Backup created. Store the ZIP in a safe place.');
    }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
    finally{exporting=false;}
  }
  async function validateNow(){
    if(validating||restoring||!file)return;
    validating=true;preview=null;message='';error='';
    try{preview=await upload('preview') as Preview;}
    catch(cause){error=cause instanceof Error?cause.message:String(cause);}
    finally{validating=false;}
  }
  async function restoreNow(){
    if(restoring||!file||!preview)return;
    if(!confirm(tr('Achtung: Der Import ERSETZT alle Einkaufslisten, Vorräte, Produkte und Kategorien dieser Instanz. Ein Sicherheits-Backup wird vor dem Überschreiben erstellt. Wirklich fortfahren?','Warning: Import REPLACES all shopping lists, pantry items, products and categories. A safety backup is created first. Continue?')))return;
    restoring=true;error='';message='';
    try{
      const result=await upload('restore') as {importedRecords:number;safetyBackup:string};
      preview=null;file=null;
      await onRestored();
      message=tr(`Import erfolgreich: ${result.importedRecords} Datensätze. Sicherheits-Backup auf dem Server: ${result.safetyBackup}.`,`Restore successful: ${result.importedRecords} records. Safety backup on server: ${result.safetyBackup}.`);
    }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
    finally{restoring=false;}
  }
</script>

<section class="backup-area" aria-labelledby="backup-title">
  <h2 id="backup-title">{tr('Daten sichern & umziehen','Back up & move data')}</h2>
  <p class="subtle">{tr('Einkaufslisten, Vorräte, Produkte und Kategorien als ZIP sichern und auf einer anderen Instanz wiederherstellen. Passwörter, Sitzungen und Server-Konfiguration werden nicht exportiert.','Export shopping lists, pantry, products and categories as ZIP and restore them on another instance. Passwords, sessions and server configuration are excluded.')}</p>
  <div class="backup-actions">
    <button class="backup-button" disabled={exporting||restoring} onclick={exportNow}>
      {exporting?tr('Backup wird erstellt …','Creating backup …'):tr('↓ Daten exportieren (ZIP)','↓ Export data (ZIP)')}
    </button>
  </div>
  <h3>{tr('Daten importieren','Import data')}</h3>
  <p class="warning"><strong>{tr('Achtung: Der Import ersetzt vorhandene Daten.','Warning: Import replaces existing data.')}</strong> {tr('Bitte vorher ein eigenes Backup herunterladen. Zusätzlich speichert der Server direkt vor dem Import ein Sicherheits-Backup.','Download your own backup first. The server also creates a safety backup immediately before restoring.')}</p>
  <label class="file-label">
    {tr('Backup-ZIP auswählen (max. 32 MiB)','Choose backup ZIP (max. 32 MiB)')}
    <input type="file" accept=".zip,application/zip,application/x-zip-compressed" disabled={restoring||validating} onchange={selected}/>
  </label>
  <div class="backup-actions">
    <button class="backup-button" disabled={!file||validating||restoring} onclick={validateNow}>
      {validating?tr('Prüfe ZIP …','Checking ZIP …'):tr('ZIP prüfen','Validate ZIP')}
    </button>
    {#if preview}
      <button class="backup-button danger" disabled={restoring||validating} onclick={restoreNow}>
        {restoring?tr('Import läuft …','Restoring …'):tr('Vorhandene Daten ersetzen','Replace existing data')}
      </button>
    {/if}
  </div>
  {#if preview}
    <div class="preview" role="status">
      <strong>{tr('Backup erfolgreich geprüft','Backup verified')}</strong>
      <p>{tr('Exportdatum','Export date')}: {new Date(preview.createdAt).toLocaleString(lang)}</p>
      <p>{tr('App-Version','App version')}: {preview.appVersion} · {tr('Schema','Schema')}: {preview.schemaVersion}</p>
      <p>{tr('Datensätze','Records')}: {preview.totalRecords}</p>
    </div>
  {/if}
  {#if message}<p class="success" role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .backup-area{display:grid;gap:12px;margin-top:24px;padding-top:22px;border-top:1px solid #4a5563}
  .backup-area h2,.backup-area h3{margin:0}.backup-area h3{font-size:17px;margin-top:10px}
  .backup-area p{margin:0;line-height:1.55}.subtle{color:#aebac8;font-size:13px}
  .backup-actions{display:flex;gap:9px;flex-wrap:wrap}
  .backup-button{min-height:42px;padding:10px 14px;border:1px solid #587b73;border-radius:10px;background:#243b38;color:#ecfdf5;cursor:pointer;font-weight:600}
  .backup-button:disabled{opacity:.5;cursor:not-allowed}
  .backup-button.danger{background:#542e33;border-color:#bb646d;color:#fff}
  .file-label{display:grid;gap:8px;font-size:13px;font-weight:600}
  .file-label input{width:100%;padding:10px;border:1px solid #546273;border-radius:10px;color:inherit;background:#1c2631}
  .warning{padding:12px;border:1px solid #a97a43;background:#4c392850;border-radius:10px;color:#fce3ae;font-size:13px}
  .preview{padding:12px;border:1px solid #457965;border-radius:10px;font-size:13px}
  .success{color:#86efac;font-size:13px}.error{color:#fecaca;font-size:13px}
</style>
