<script lang="ts">
  import { onMount } from 'svelte';
  import { parseCSV,CSV_TEMPLATE,importPrompt,normalized,units,type Draft,type Unit } from '../pantry-import';
  import { productEmoji } from './product-emoji';
  import { matchReceipt,rowIssues } from '../receipt-matching';
  type Product={id:string;name_de:string;name_en:string|null;category_id:string};
  type Category={id:string;name_de:string;name_en:string};
  type Row=Draft & {key:number;categoryId:string;selected:boolean;productId:string|null;uncertain?:boolean;estimated?:boolean};
  type Confirmed={name:string;quantity:number;unit:Unit;categoryId:string;variant:string;productId:string|null};
  export let products:Product[];
  export let categories:Category[];
  export let lang:'de'|'en';
  export let onClose:()=>void;
  export let onImport:(id:string,items:Confirmed[])=>Promise<void>;
  const tr=(de:string,en:string)=>lang==='de'?de:en;
  let mode:'receipt'|'photo'|'csv'='receipt';
  let file:File|null=null, csv='', rows:Row[]=[], message='', busy=false, approved=false, vision=false, capabilitiesLoaded=false;
  let serial=0;
  // getRandomValues works on HTTP localhost and ordinary LAN origins, unlike randomUUID.
  const random=()=>{const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;const h=Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
  let importId='';
  onMount(()=>{
    importId=random();
    fetch('/api/v1/pantry/scan').then(async r=>{if(r.ok)vision=!!(await r.json()).vision;}).catch(()=>{}).finally(()=>capabilitiesLoaded=true);
  });
  $: selected=rows.filter(r=>r.selected);
  $: invalid=selected.filter(r=>rowIssues(r,categories).length>0);
  $: ready=selected.length>0&&selected.length<=200&&invalid.length===0;
  function issueLabel(issue:string){
    return issue==='name'?tr('Produktname fehlt oder ungültig','Product name missing or invalid'):issue==='quantity'?tr('Gültige Menge eingeben','Enter a valid quantity'):issue==='category'?tr('Kategorie auswählen','Select a category'):tr('Variante zu lang','Variant too long');
  }
  function fillQuantities(){
    rows=rows.map(r=>r.selected&&(r.quantity===null||!Number.isFinite(r.quantity)||r.quantity<=0)?{...r,quantity:1,unit:'pcs',estimated:true}:r);approved=false;
  }
  $: prompt=importPrompt(categories.map(c=>c.name_de));
  function resolve(d:Draft,receipt=false):Row{
    if(receipt){
      const m=matchReceipt(d,products,categories);
      return {...d,...m,key:++serial,categoryId:m.category,selected:true};
    }
    const candidates=products.filter(p=>[p.name_de,p.name_en||''].some(n=>normalized(n)===normalized(d.name)));
    const exact=candidates.length===1?candidates[0]:undefined;
    const category=categories.find(c=>[c.id,c.name_de,c.name_en].some(n=>normalized(n)===normalized(d.category)));
    return {...d,key:++serial,name:exact?.name_de||d.name,categoryId:exact?.category_id||category?.id||'',productId:exact?.id||null,selected:true};
  }
  function edit(row:Row,patch:Partial<Row>){
    rows=rows.map(r=>{
      if(r.key!==row.key)return r;
      const next={...r,...patch};
      if(patch.quantity!==undefined||patch.unit!==undefined)next.estimated=false;
      if(patch.name!==undefined||patch.categoryId!==undefined)next.uncertain=false;
      if(patch.name!==undefined||patch.categoryId!==undefined){
        const p=products.filter(p=>p.category_id===next.categoryId&&normalized(p.name_de)===normalized(next.name));
        next.productId=p.length===1?p[0].id:null;
      }
      return next;
    });approved=false;
  }
  function chooseProduct(row:Row,id:string){
    const p=products.find(p=>p.id===id);
    if(p)edit(row,{name:p.name_de,categoryId:p.category_id,productId:p.id});
  }
  function selectMode(next:typeof mode){
    if(rows.length&&!confirm(tr('Aktuellen Entwurf verwerfen?','Discard the current draft?')))return;
    mode=next;file=null;rows=[];approved=false;message='';importId=random();
  }
  function loadDraft(items:Draft[]){
    if(!items.length){message=tr('Keine sicheren Produktvorschläge gefunden. Ergänze Zeilen manuell oder nutze CSV.','No reliable suggestions found. Add rows manually or use CSV.');return;}
    rows=items.map(d=>resolve(d,mode==='receipt'));approved=false;importId=random();
  }
  async function analyze(){
    if(busy)return;busy=true;message='';
    try{
      if(mode==='csv'){
        if(file&&file.size>100000)throw Error('CSV maximum 100 KB');
        loadDraft(parseCSV(file?await file.text():csv));
      }else{
        if(!file)throw Error(tr('Bitte eine Datei auswählen.','Choose a file.'));
        if(file.size>5*1024*1024)throw Error('5 MB maximum');
        const mime=file.type||(/\.pdf$/i.test(file.name)?'application/pdf':/\.png$/i.test(file.name)?'image/png':/\.jpe?g$/i.test(file.name)?'image/jpeg':/\.txt$/i.test(file.name)?'text/plain':'');
        const result=await fetch('/api/v1/pantry/scan',{method:'POST',headers:{'Content-Type':mime,'X-Scan-Mode':mode},body:file});
        const body=await result.json();
        if(!result.ok)throw Error(body.error||('HTTP '+result.status));
        loadDraft(body.items);
      }
    }catch(e){message=e instanceof Error?e.message:String(e);}finally{busy=false;}
  }
  function addRow(){
    if(rows.length>=200)return;
    rows=[...rows,resolve({name:'',quantity:null,unit:'pcs',category:'',variant:''})];approved=false;
  }
  function download(text:string,filename:string,mime:string){
    const url=URL.createObjectURL(new Blob([text],{type:mime}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function save(){
    if(!ready||!approved||busy)return;
    busy=true;message='';
    try{await onImport(importId,selected.map(r=>({name:r.name.trim(),quantity:r.quantity!,unit:r.unit,categoryId:r.categoryId,variant:r.variant.trim(),productId:r.productId}))); }
    catch(e){message=e instanceof Error?e.message:String(e);}finally{busy=false;}
  }
  function close(){if(!busy&&(!rows.length||confirm(tr('Entwurf schließen? Nicht importierte Produkte werden verworfen.','Close draft? Unimported products will be discarded.'))))onClose();}
</script>
<div class="scrim">
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
    <header><div><h2 id="import-title">📷 {tr('Vorräte scannen & importieren','Scan & import pantry')}</h2><p>{tr('Erkennen → prüfen → bestätigen. Vor der Freigabe wird nichts gespeichert.','Recognize → review → confirm. Nothing is saved before approval.')}</p></div><button type="button" disabled={busy} onclick={close} aria-label={tr('Schließen','Close')}>×</button></header>
    <div class="modes">
      <button type="button" class:active={mode==='receipt'} disabled={busy} onclick={()=>selectMode('receipt')}>🧾 {tr('Kassenbon','Receipt')}</button>
      <button type="button" class:active={mode==='photo'} disabled={busy} onclick={()=>selectMode('photo')}>📸 {tr('Kühlschrank / Einkauf','Fridge / groceries')}</button>
      <button type="button" class:active={mode==='csv'} disabled={busy} onclick={()=>selectMode('csv')}>📄 {tr('KI / CSV','AI / CSV')}</button>
    </div>
    <div class="scroll">
      {#if !rows.length}
        {#if mode==='csv'}
          <p>{tr('Lass eine KI deiner Wahl den Bon oder das Foto in eine CSV umwandeln. Lade danach die Datei hier hoch oder füge den CSV-Text ein.','Ask an AI of your choice to convert the receipt or photo to CSV. Then upload the file or paste the CSV text here.')}</p>
          <div class="actions"><button type="button" onclick={()=>download(CSV_TEMPLATE,'vorrats-import.csv','text/csv;charset=utf-8')}>{tr('CSV-Vorlage herunterladen','Download CSV template')}</button><button type="button" onclick={()=>download(prompt,'ki-import-prompt.txt','text/plain;charset=utf-8')}>{tr('KI-Prompt herunterladen','Download AI prompt')}</button></div>
          <details><summary>{tr('Prompt zum Kopieren anzeigen','Show prompt to copy')}</summary><textarea readonly rows="7" value={prompt} aria-label="KI Prompt"></textarea></details>
          <p class="hint">{tr('Bei externer KI selbst über Datenschutz entscheiden und Kunden-/Zahlungsdaten vorher schwärzen.','With external AI, decide on privacy yourself and redact customer/payment data first.')}</p>
          <label>{tr('CSV-Text (alternativ zur Datei)','CSV text (instead of file)')}<textarea rows="5" bind:value={csv} maxlength="100000" placeholder="produkt;menge;einheit;kategorie;variante"></textarea></label>
        {:else if mode==='receipt'}
          <p>{tr('Fotografierten Bon oder digitalen PDF-/TXT-Kassenbon auswählen. Die lokale Texterkennung schlägt Artikel vor. Mengen und Namen können unklar sein.','Choose a receipt photo or digital PDF/TXT. Local recognition suggests products. Quantities and names may be uncertain.')}</p>
          <p class="hint">{tr('JPG/PNG/PDF/TXT, bis 5 MB, PDF bis 3 Seiten.','JPG/PNG/PDF/TXT, up to 5 MB, PDF up to 3 pages.')}</p>
        {:else}
          <p>{tr('Fotografiere den Kühlschrank oder den Einkauf. Eine lokale Bild-KI erkennt sichtbare Produkte; keine verdeckten Waren oder sicheren Mengen.','Photograph your fridge or groceries. Local vision recognizes visible items, not hidden products or reliable quantities.')}</p>
          {#if capabilitiesLoaded&&!vision}<p class="hint">{tr('Lokale Bild-KI ist noch nicht konfiguriert. Nutze bis dahin den KI-/CSV-Weg.','Local vision is not configured yet. Use the AI/CSV option for now.')}</p>{/if}
        {/if}
        <label>{tr('Datei auswählen','Choose file')}<input type="file" disabled={busy||(mode==='photo'&&!vision)} accept={mode==='csv'?'.csv,text/csv':mode==='photo'?'image/jpeg,image/png':'image/jpeg,image/png,application/pdf,text/plain,.txt'} onchange={e=>file=e.currentTarget.files?.[0]||null}/></label>
        {#if mode==='photo'||mode==='receipt'}<label>{tr('Direkt Foto aufnehmen (Mobilgerät)','Take photo directly (mobile)')}<input type="file" accept="image/jpeg,image/png" capture="environment" disabled={busy||(mode==='photo'&&!vision)} onchange={e=>file=e.currentTarget.files?.[0]||null}/></label>{/if}
        {#if file}<p>{file.name}</p>{/if}
        <button type="button" class="primary" disabled={busy||(mode==='photo'&&!vision)||(!file&&(mode!=='csv'||!csv.trim()))} onclick={analyze}>{busy?tr('Wird ausgewertet …','Analyzing …'):tr('Auswerten / Vorschau erstellen','Analyze / create preview')}</button>
        {#if !busy}<button type="button" onclick={addRow}>{tr('Stattdessen manuell erfassen','Enter manually instead')}</button>{/if}
      {:else}
        <h3>{tr('Importvorschau','Import preview')} · {selected.length}/{rows.length}</h3>
        <p class="hint">{tr('Import erhöht den Bestand durch zusätzliche Einträge. Prüfe insbesondere Kühlschrankfotos auf bereits erfasste Produkte. Unbekannte Mengen und Kategorien musst du ergänzen.','Import adds new stock entries. Check fridge photos for items already recorded. Fill in unknown quantities and categories.')}</p>
        {#each rows as row(row.key)}
          <article class:excluded={!row.selected} class:invalid={row.selected&&rowIssues(row,categories).length>0}>
            <div class="rowhead"><label class="include"><input type="checkbox" checked={row.selected} disabled={busy} onchange={e=>edit(row,{selected:e.currentTarget.checked})}/> {productEmoji(row.name,row.categoryId)} {tr('Übernehmen','Include')}</label><button type="button" disabled={busy} onclick={()=>{rows=rows.filter(r=>r.key!==row.key);approved=false;}} aria-label={tr('Entfernen','Remove')}>×</button></div>
            {#if row.source}<small>{tr('Original: ','Original: ')}{row.source}</small>{/if}
            {#if row.uncertain}<small class="warning">{tr('Unsichere Produktzuordnung – bitte prüfen.','Uncertain product match – please review.')}</small>{/if}
            {#if row.estimated}<small class="warning">{tr('Menge 1 Stück vorgeschlagen – Packungsgröße und Anzahl prüfen.','Suggested quantity: 1 piece – check package size and count.')}</small>{/if}
            {#if row.selected&&rowIssues(row,categories).length}<small class="error">{rowIssues(row,categories).map(issueLabel).join(' · ')}</small>{/if}
            <label>{tr('Produktname','Product name')}<input disabled={busy} maxlength="120" value={row.name} oninput={e=>edit(row,{name:e.currentTarget.value})}/></label>
            <label>{tr('Vorhandenes Produkt zuordnen (optional)','Match existing product (optional)')}<select disabled={busy} value={row.productId||''} onchange={e=>chooseProduct(row,e.currentTarget.value)}><option value="">{tr('Freitext / neu','Free text / new')}</option>{#each products as p(p.id)}<option value={p.id}>{p.name_de}</option>{/each}</select></label>
            <div class="fields">
              <label>{tr('Menge','Quantity')}<input disabled={busy} type="number" min="0.001" max="1000000" step="any" value={row.quantity??''} placeholder="?" oninput={e=>edit(row,{quantity:e.currentTarget.value===''?null:e.currentTarget.valueAsNumber})}/></label>
              <label>{tr('Einheit','Unit')}<select disabled={busy} value={row.unit} onchange={e=>edit(row,{unit:e.currentTarget.value as Unit})}>{#each units as u}<option value={u}>{u}</option>{/each}</select></label>
            </div>
            <label>{tr('Kategorie','Category')}<select disabled={busy} value={row.categoryId} onchange={e=>edit(row,{categoryId:e.currentTarget.value})}><option value="">{tr('Bitte wählen','Choose category')}</option>{#each categories as c(c.id)}<option value={c.id}>{lang==='de'?c.name_de:c.name_en}</option>{/each}</select></label>
            <label>{tr('Variante (optional)','Variant (optional)')}<input disabled={busy} maxlength="80" value={row.variant} oninput={e=>edit(row,{variant:e.currentTarget.value})}/></label>
          </article>
        {/each}
        {#if selected.some(r=>r.quantity===null||!Number.isFinite(r.quantity)||r.quantity<=0)}<button type="button" disabled={busy} onclick={fillQuantities}>{tr('Fehlende Mengen als 1 Stück vorschlagen','Suggest 1 piece for missing quantities')}</button>{/if}
        <button type="button" disabled={busy||rows.length>=200} onclick={addRow}>＋ {tr('Zeile ergänzen','Add row')}</button>
      {/if}
      {#if message}<p class="error" role="alert">{message}</p>{/if}
    </div>
    {#if rows.length}<footer>
      {#if !ready}<p class="error" role="status">{invalid.length?tr(invalid.length+' ausgewählte Position(en) müssen noch korrigiert oder abgewählt werden.','Correct or exclude '+invalid.length+' selected item(s).'):tr('Mindestens ein Produkt auswählen.','Select at least one product.')}</p>{/if}
      <label class="include"><input type="checkbox" bind:checked={approved} disabled={busy}/> {tr('Ich habe die gewählten Produkte, Mengen und Kategorien geprüft.','I have reviewed the selected products, quantities and categories.')}</label><button class="primary" type="button" disabled={!approved||!ready||busy} onclick={save}>{busy?tr('Import läuft …','Importing …'):tr('Verbindlich importieren','Confirm import')+' · '+selected.length}</button></footer>{/if}
  </div>
</div>
<style>
  .scrim{position:fixed;inset:0;background:#000b;display:grid;place-items:center;z-index:40;padding:14px}
  .dialog{width:min(100%,760px);max-height:calc(100dvh - 28px);display:flex;flex-direction:column;overflow:hidden;color:#eff5f8;background:#222a34;border:1px solid #48535f;border-radius:20px}
  header{display:flex;gap:12px;justify-content:space-between;padding:20px 22px 12px;align-items:start}h2{margin:0;font-size:21px}p{font-size:13px;color:#b8c6d2;line-height:1.5}header p{margin:7px 0}
  button{background:#303c47;border:1px solid #526171;color:#eef5f8;border-radius:10px;padding:10px 12px;cursor:pointer;font:inherit;font-size:13px}button:disabled{opacity:.45;cursor:not-allowed}.primary,.active{background:var(--accent,#a7f3d0);color:var(--accent-ink,#112c28);font-weight:700}
  .modes,.actions{display:flex;flex-wrap:wrap;gap:8px}.modes{padding:0 22px 12px}.modes button{flex:1}
  .scroll{padding:0 22px 20px;overflow:auto;min-height:0;display:grid;gap:12px}.scroll p,.scroll h3{margin:0}.hint{padding:10px;border-radius:9px;background:#303b45}.error{color:#ffc1c1}
  label{display:grid;gap:5px;font-size:12px;color:#d5e1ea}input,select,textarea{min-width:0;width:100%;background:#141c23;color:#f4f7fa;border:1px solid #596977;border-radius:9px;padding:10px;font:inherit;box-sizing:border-box}
  article{border:1px solid #495764;border-radius:13px;padding:13px;display:grid;gap:10px;background:#262f39}.excluded{opacity:.58}.invalid{border-color:#ed9c9c}.warning{color:#ffda94}footer p{margin:0}.rowhead,.fields{display:flex;gap:10px;align-items:center;justify-content:space-between}.fields label{flex:1}.include{display:flex;align-items:center;gap:8px}.include input{width:20px;height:20px;accent-color:var(--accent,#a7f3d0);flex-shrink:0}
  footer{padding:14px 22px;border-top:1px solid #465361;background:#1c252d;display:grid;gap:10px}small{color:#a8b8c6;overflow-wrap:anywhere}
  @media(max-width:550px){.scrim{padding:0}.dialog{max-height:100dvh;width:100%;height:100dvh;border-radius:0}header{padding:16px}.modes{padding:0 12px 12px}.scroll{padding:0 14px 14px}footer{padding:12px 14px max(12px,env(safe-area-inset-bottom))}}
</style>