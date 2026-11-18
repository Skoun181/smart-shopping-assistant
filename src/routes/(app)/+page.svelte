<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  type Product={id:string;category_id:string;name_de:string;name_en:string|null;brand:string|null;source:string};
  type Category={id:string;name_de:string;name_en:string};
  type Variant={id:string;product_id:string;label_de:string;label_en:string|null};
  type Item={id:string;name_snapshot:string;name_de:string|null;name_en:string|null;variant_de:string|null;variant_en:string|null;quantity:number;unit_id:string;checked?:number;version:number;note?:string};
  let tab:'dashboard'|'shopping'|'pantry'|'catalog'|'settings'='dashboard';
  let lang:'de'|'en'='de',theme:'mint'|'violet'='mint';
  let products:Product[]=[],categories:Category[]=[],variants:Variant[]=[],shopping:Item[]=[],pantry:Item[]=[];
  let query='',chosen='',chosenVariant='',categoryFilter='',qty=1,unit='pcs',note='';
  let customName='',customEnglish='',customCategory='produce',customVariant='';
  let modal:'shopping'|'pantry'|'custom'|null=null;
  let loading=true,error='',working=false;
  let live:EventSource|undefined;
  const tr=(de:string,en:string)=>lang==='de'?de:en;
  const title=(item:Product|Item)=>lang==='en'&&item.name_en?item.name_en:('name_de' in item&&item.name_de?item.name_de:'name_snapshot' in item?item.name_snapshot:'');
  const itemVariant=(item:Item)=>lang==='en'&&item.variant_en?item.variant_en:item.variant_de;
  const unitLabel=(value:string)=>({pcs:tr('Stk.','pcs'),pack:tr('Pkg.','pack'),g:'g',kg:'kg',ml:'ml',l:'l'}[value]??value);
  const itemLabel=(item:Item)=>[title(item),itemVariant(item)].filter(Boolean).join(' · ');
  async function request<T>(path:string,options?:RequestInit):Promise<T>{
    const res=await fetch('/api/v1'+path,{...options,headers:{...(options?.body?{'Content-Type':'application/json'}:{}),...options?.headers}});
    if(res.status===401){await goto('/login');throw new Error('Session expired');}
    if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.error??('HTTP '+res.status));}
    return await res.json();
  }
  async function refresh(topic?:string){
    try{
      if(!topic||topic==='catalog'){const data=await request<{products:Product[];categories:Category[];variants:Variant[]}>('/catalog');products=data.products;categories=data.categories;variants=data.variants;}
      if(!topic||topic==='shopping')shopping=(await request<{items:Item[]}>('/shopping')).items;
      if(!topic||topic==='pantry')pantry=(await request<{items:Item[]}>('/pantry')).items;
      error='';
    }catch(e){error=String(e);}loading=false;
  }
  onMount(()=>{
    const savedLang=localStorage.getItem('shopping-lang');
    lang=savedLang==='de'||savedLang==='en'?savedLang:(navigator.language.startsWith('de')?'de':'en');
    theme=localStorage.getItem('shopping-theme')==='violet'?'violet':'mint';
    refresh();
    live=new EventSource('/api/v1/events');
    live.onmessage=(event)=>{try{refresh(JSON.parse(event.data).topic);}catch{refresh();}};
    return ()=>live?.close();
  });
  function chooseLanguage(v:'de'|'en'){lang=v;localStorage.setItem('shopping-lang',v);}
  function chooseTheme(v:'mint'|'violet'){theme=v;localStorage.setItem('shopping-theme',v);}
  function openModal(v:'shopping'|'pantry'|'custom'){modal=v;chosen='';chosenVariant='';qty=1;unit='pcs';query='';note='';error='';}
  async function addItem(){
    if(!chosen||qty<=0)return;working=true;
    try{
      await request(modal==='shopping'?'/shopping':'/pantry',{method:'POST',body:JSON.stringify({productId:chosen,variantId:chosenVariant||null,quantity:Number(qty),unitId:unit,...(modal==='shopping'?{note}:{locationId:'home'})})});
      modal=null;await refresh();
    }catch(e){error=String(e);}finally{working=false;}
  }
  async function updateItem(item:Item,scope:'shopping'|'pantry',body:Record<string,unknown>){
    try{await request('/'+scope+'/'+item.id,{method:'PATCH',body:JSON.stringify({...body,expectedVersion:item.version})});await refresh(scope);}
    catch(e){error=tr('Änderung fehlgeschlagen: ','Change failed: ')+String(e);await refresh(scope);}
  }
  async function removeItem(item:Item,scope:'shopping'|'pantry'){
    if(!confirm(tr('Eintrag entfernen?','Remove item?')))return;
    try{await request('/'+scope+'/'+item.id,{method:'DELETE'});await refresh(scope);}catch(e){error=String(e);}
  }
  async function customProduct(){
    if(!customName.trim())return;working=true;
    try{await request('/catalog',{method:'POST',body:JSON.stringify({nameDe:customName.trim(),...(customEnglish.trim()?{nameEn:customEnglish.trim()}:{}),categoryId:customCategory,...(customVariant.trim()?{variantDe:customVariant.trim()}:{} )})});
      customName='';customEnglish='';customVariant='';modal=null;await refresh('catalog');
    }catch(e){error=String(e);}finally{working=false;}
  }
  async function logout(){await request('/auth/logout',{method:'POST'});await goto('/login');}
  $: outstanding=shopping.filter(i=>!i.checked).length;
  $: completed=shopping.filter(i=>i.checked).length;
  $: available=products.filter(p=>(!categoryFilter||p.category_id===categoryFilter)&&title(p).toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,80);
  $: selectedVariants=variants.filter(v=>v.product_id===chosen);
</script>
<svelte:head><title>Smart Shopping Assistant</title><meta name="description" content="Private Einkaufslisten und Vorräte"/></svelte:head>
<div class:violet={theme==='violet'} class="app">
  <aside class="sidebar">
    <div class="brand"><span class="brand-icon">🛒</span><div><strong>Smart Shopping</strong><small>Assistant · Beta</small></div></div>
    <nav aria-label="Navigation">
      <button class:active={tab==='dashboard'} onclick={()=>tab='dashboard'}>⌂ &nbsp; {tr('Übersicht','Overview')}</button>
      <button class:active={tab==='shopping'} onclick={()=>tab='shopping'}>☷ &nbsp; {tr('Einkaufsliste','Shopping list')}</button>
      <button class:active={tab==='pantry'} onclick={()=>tab='pantry'}>▤ &nbsp; {tr('Vorräte','Pantry')}</button>
      <button class:active={tab==='catalog'} onclick={()=>tab='catalog'}>◈ &nbsp; {tr('Produkte','Products')}</button>
      <button class:active={tab==='settings'} onclick={()=>tab='settings'}>⚙ &nbsp; {tr('Einstellungen','Settings')}</button>
    </nav>
    <div class="side-footer">● {tr('Lokal verbunden','Local connection')}</div>
  </aside>
  <main>
    <header class="topbar"><div><span class="eyebrow">SMART SHOPPING ASSISTANT</span><h1>{tab==='dashboard'?tr('Hallo Zuhause 👋','Hello home 👋'):tab==='shopping'?tr('Einkaufsliste','Shopping list'):tab==='pantry'?tr('Unsere Vorräte','Our pantry'):tab==='catalog'?tr('Produktkatalog','Product catalog'):tr('Einstellungen','Settings')}</h1></div><span class="beta">BETA 0.1</span></header>
    {#if error}<div class="error" role="alert">{error}<button aria-label="Close" onclick={()=>error=''}>×</button></div>{/if}
    {#if loading}<p>{tr('Lade Haushaltsdaten …','Loading household data …')}</p>
    {:else if tab==='dashboard'}
      <p class="subtle">{tr('Alles Wichtige für deinen nächsten Einkauf auf einen Blick.','Everything you need for your next shopping trip.')}</p>
      <div class="stats">
        <article class="stat"><span>🛍️</span><strong>{outstanding}</strong><small>{tr('Noch zu kaufen','To buy')}</small></article>
        <article class="stat"><span>✓</span><strong>{completed}</strong><small>{tr('Schon erledigt','Completed')}</small></article>
        <article class="stat"><span>▤</span><strong>{pantry.length}</strong><small>{tr('Vorratspositionen','Pantry items')}</small></article>
      </div>
      <section class="panel"><div class="heading"><h2>{tr('Nächster Einkauf','Next shopping trip')}</h2><button class="link" onclick={()=>tab='shopping'}>{tr('Alle anzeigen','View all')} →</button></div>
        {#if !outstanding}<p class="empty">{tr('Alles erledigt! Füge dein erstes Produkt hinzu.','All done! Add your first item.')}</p>{/if}
        {#each shopping.filter(i=>!i.checked).slice(0,6) as item(item.id)}
          <div class="item"><input type="checkbox" aria-label={tr('Als gekauft markieren','Mark purchased')} checked={!!item.checked} onchange={()=>updateItem(item,'shopping',{checked:true})}/><div class="item-name"><strong>{itemLabel(item)}</strong><small>{item.quantity} {unitLabel(item.unit_id)}</small></div></div>
        {/each}<button class="primary" onclick={()=>openModal('shopping')}>＋ {tr('Produkt hinzufügen','Add product')}</button>
      </section>
    {:else if tab==='shopping'||tab==='pantry'}
      <div class="heading section-head"><p class="subtle">{tab==='shopping'?tr('Gemeinsam einkaufen.','Shop together.'):tr('Was ist noch zu Hause vorhanden?','What do we have at home?')}</p><button class="primary" onclick={()=>openModal(tab)}>＋ {tr('Hinzufügen','Add item')}</button></div>
      {#if (tab==='shopping'?shopping:pantry).length===0}<section class="panel empty">{tr('Noch keine Einträge. Leg direkt los!','Nothing here yet. Add something!')}</section>{/if}
      <section class="panel list">
        {#each (tab==='shopping'?shopping:pantry) as item(item.id)}
          <div class:done={!!item.checked&&tab==='shopping'} class="item">
            {#if tab==='shopping'}<input type="checkbox" checked={!!item.checked} aria-label={tr('Kaufstatus ändern','Change purchase status')} onchange={()=>updateItem(item,'shopping',{checked:!item.checked})}/>{:else}<span class="symbol">▤</span>{/if}
            <div class="item-name"><strong>{itemLabel(item)}</strong><small>{item.quantity} {unitLabel(item.unit_id)} {item.note?' · '+item.note:''}</small></div>
            <button class="small-button" title={tr('Menge bearbeiten','Edit quantity')} onclick={()=>{const raw=prompt(tr('Neue Menge','New quantity'),String(item.quantity));if(raw!==null&&raw.trim()&&Number(raw)>0&&Number(raw)<=1000000)updateItem(item,tab,{quantity:Number(raw)});}}>✎</button>
            <button class="small-button danger" title={tr('Entfernen','Delete')} onclick={()=>removeItem(item,tab)}>×</button>
          </div>
        {/each}
      </section>
    {:else if tab==='catalog'}
      <div class="heading section-head"><p class="subtle">{tr('Deine Standard- und eigenen Produkte.','Your standard and custom products.')}</p><button class="primary" onclick={()=>openModal('custom')}>＋ {tr('Eigenes Produkt','Custom product')}</button></div>
      <div class="filters"><input aria-label={tr('Produkte suchen','Search products')} placeholder={tr('Produkte suchen…','Search products…')} bind:value={query}/><select aria-label={tr('Kategorie','Category')} bind:value={categoryFilter}><option value="">{tr('Alle Kategorien','All categories')}</option>{#each categories as cat}<option value={cat.id}>{lang==='de'?cat.name_de:cat.name_en}</option>{/each}</select></div>
      <section class="panel list">{#each available as p(p.id)}<div class="item"><span class="symbol">◈</span><div class="item-name"><strong>{title(p)}</strong><small>{p.brand??categories.find(c=>c.id===p.category_id)?.[lang==='de'?'name_de':'name_en']??''}</small></div>{#if p.source==='custom'}<span class="tag">{tr('Eigen','Custom')}</span>{/if}<button class="small-button" title={tr('Zur Einkaufsliste','Add to shopping list')} onclick={()=>{openModal('shopping');chosen=p.id;}}>＋</button></div>{/each}</section>
    {:else if tab==='settings'}
      <section class="panel preferences"><h2>{tr('Darstellung','Appearance')}</h2><p class="subtle">{tr('Die Auswahl gilt nur für diesen Browser.','Preferences apply to this browser only.')}</p>
        <h3>{tr('Farbschema','Theme')}</h3><div class="choices"><button class:chosen={theme==='mint'} onclick={()=>chooseTheme('mint')}>🟢 Dark Mint</button><button class:chosen={theme==='violet'} onclick={()=>chooseTheme('violet')}>🟣 Dark Violet</button></div>
        <h3>{tr('Sprache','Language')}</h3><div class="choices"><button class:chosen={lang==='de'} onclick={()=>chooseLanguage('de')}>Deutsch</button><button class:chosen={lang==='en'} onclick={()=>chooseLanguage('en')}>English</button></div>
        <h3>{tr('Sitzung','Session')}</h3><button class="secondary" onclick={logout}>{tr('Abmelden','Sign out')}</button>
        <p class="subtle">{tr('Beta 0.1 · Nur für private Heimnetzwerke','Beta 0.1 · Private home networks only')}</p>
      </section>
    {/if}
  </main>
  <nav class="mobile-nav" aria-label="Mobile navigation">
    <button class:active={tab==='dashboard'} onclick={()=>tab='dashboard'}>⌂<small>{tr('Start','Home')}</small></button>
    <button class:active={tab==='shopping'} onclick={()=>tab='shopping'}>☷<small>{tr('Einkauf','Shopping')}</small></button>
    <button class:active={tab==='pantry'} onclick={()=>tab='pantry'}>▤<small>{tr('Vorräte','Pantry')}</small></button>
    <button class:active={tab==='catalog'} onclick={()=>tab='catalog'}>◈<small>{tr('Produkte','Products')}</small></button>
    <button class:active={tab==='settings'} onclick={()=>tab='settings'}>⚙<small>{tr('Mehr','More')}</small></button>
  </nav>
  {#if modal}
    <div class="backdrop" role="presentation">
      <div class="dialog" role="dialog" aria-modal="true" aria-label={tr('Eintrag hinzufügen','Add item')}>
        <div class="heading"><h2>{modal==='custom'?tr('Eigenes Produkt erstellen','Create custom product'):modal==='shopping'?tr('Zur Einkaufsliste','Add to shopping list'):tr('Vorrat hinzufügen','Add to pantry')}</h2><button class="small-button" aria-label={tr('Schließen','Close')} onclick={()=>modal=null}>×</button></div>
        {#if modal==='custom'}
          <form onsubmit={(e)=>{e.preventDefault();customProduct();}}>
            <label>{tr('Produktname (Deutsch)','Product name (German)')}<input required maxlength="120" bind:value={customName}/></label>
            <label>{tr('Englischer Name (optional)','English name (optional)')}<input maxlength="120" bind:value={customEnglish}/></label>
            <label>{tr('Kategorie','Category')}<select bind:value={customCategory}>{#each categories as cat}<option value={cat.id}>{lang==='de'?cat.name_de:cat.name_en}</option>{/each}</select></label>
            <label>{tr('Variante (optional)','Variant (optional)')}<input maxlength="80" bind:value={customVariant}/></label>
            <button disabled={working} type="submit" class="primary">{tr('Produkt speichern','Save product')}</button>
          </form>
        {:else}
          <form onsubmit={(e)=>{e.preventDefault();addItem();}}>
            <label>{tr('Produkt suchen','Search product')}<input placeholder={tr('z. B. Milch','e.g. Milk')} bind:value={query}/></label>
            <label>{tr('Produkt auswählen','Select product')}<select required bind:value={chosen} onchange={()=>chosenVariant=''}><option value="">{tr('Bitte auswählen…','Please select…')}</option>{#each available as p}<option value={p.id}>{title(p)}</option>{/each}</select></label>
            {#if selectedVariants.length}<label>{tr('Variante','Variant')}<select bind:value={chosenVariant}><option value="">{tr('Keine Variante','No variant')}</option>{#each selectedVariants as v}<option value={v.id}>{lang==='en'&&v.label_en?v.label_en:v.label_de}</option>{/each}</select></label>{/if}
            <div class="qty-row"><label>{tr('Menge','Quantity')}<input type="number" min="0.001" max="1000000" step="any" required bind:value={qty}/></label><label>{tr('Einheit','Unit')}<select bind:value={unit}>{#each ['pcs','pack','g','kg','ml','l'] as u}<option value={u}>{unitLabel(u)}</option>{/each}</select></label></div>
            {#if modal==='shopping'}<label>{tr('Notiz (optional)','Note (optional)')}<input maxlength="300" bind:value={note}/></label>{/if}
            <button disabled={!chosen||working} type="submit" class="primary">{tr('Hinzufügen','Add')}</button>
          </form>
        {/if}
      </div>
    </div>
  {/if}
</div>
<style>
  :global(*){box-sizing:border-box}:global(body){margin:0;font-family:Inter,system-ui,sans-serif;background:#111419}:global(button),:global(input),:global(select){font:inherit}:global(button){cursor:pointer}
  .app{--accent:#a7f3d0;--accent-ink:#112c28;--accent-soft:#283e39;min-height:100vh;display:flex;background:#12161c;color:#f4f7fa}
  .app.violet{--accent:#b8a3ff;--accent-ink:#241837;--accent-soft:#38314c}
  .sidebar{background:#181d24;width:250px;flex-shrink:0;min-height:100vh;padding:28px 16px;border-right:1px solid #303740;display:flex;flex-direction:column;gap:46px}
  .brand{display:flex;align-items:center;gap:12px;padding:0 12px}.brand-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:var(--accent-soft);font-size:23px}.brand strong{display:block;font-size:16px}.brand small{display:block;color:#8995a5;font-size:12px;margin-top:3px}
  .sidebar nav{display:grid;gap:7px}.sidebar nav button{text-align:left;background:transparent;border:0;color:#aab6c4;padding:14px 16px;border-radius:12px;font-size:14px}.sidebar nav button.active{color:var(--accent);background:var(--accent-soft);font-weight:650}.sidebar nav button:hover{background:#2a313a}
  .side-footer{margin-top:auto;padding:0 12px;color:#84cbaa;font-size:12px}
  main{max-width:1120px;width:100%;margin:0 auto;padding:38px 44px 80px}.topbar,.heading,.item{display:flex;align-items:center;justify-content:space-between;gap:12px}.eyebrow{font-size:11px;font-weight:750;letter-spacing:2px;color:var(--accent)}h1{font-size:clamp(25px,3vw,36px);letter-spacing:-.7px;margin:8px 0 0}h2{font-size:19px;margin:0}h3{font-size:14px;margin:16px 0 4px}.beta{border:1px solid #414c59;color:#a6b1bf;border-radius:99px;padding:6px 10px;font-size:11px;font-weight:700}.subtle{color:#9eabb9}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:26px 0}.stat{display:grid;gap:11px;background:#20262f;border:1px solid #323b46;border-radius:18px;padding:22px}.stat span{font-size:22px;color:var(--accent)}.stat strong{font-size:30px}.stat small{color:#aab6c4;font-size:13px}
  .panel{background:#20262f;border:1px solid #333c46;border-radius:19px;padding:22px;margin-top:22px}.link{background:none;border:0;color:var(--accent);white-space:nowrap;font-size:13px}.item{border-bottom:1px solid #343d47;padding:15px 0;justify-content:flex-start}.item:last-child{border-bottom:0}.item input[type=checkbox]{width:24px;height:24px;flex-shrink:0;accent-color:var(--accent);cursor:pointer}.item-name{flex:1;min-width:0}.item-name strong{font-size:14px;display:block;overflow-wrap:anywhere}.item-name small{display:block;color:#a2adba;font-size:12px;margin-top:5px}.done .item-name strong{text-decoration:line-through;color:#83909f}
  .primary{border:0;background:var(--accent);color:var(--accent-ink);padding:12px 18px;font-weight:750;border-radius:12px;min-height:44px}.primary:disabled{opacity:.5}.panel>.primary{margin-top:18px}.empty{padding:24px;color:#aebac7;text-align:center}.section-head{margin-top:20px}.section-head .subtle{margin:0}.small-button{border:1px solid #414c59;color:#cbd5df;background:#2a323c;border-radius:10px;width:34px;height:34px;flex-shrink:0}.danger{color:#eeaaad}.symbol{color:var(--accent);font-size:20px;min-width:26px}.tag{color:var(--accent);font-size:11px;background:var(--accent-soft);border-radius:8px;padding:5px 8px}
  .filters{display:flex;gap:12px;margin-top:24px}.filters input{flex:1;min-width:0}.filters select{max-width:220px}.filters input,.filters select,.dialog input,.dialog select{background:#171c23;border:1px solid #46515e;border-radius:10px;padding:12px;color:white;min-height:44px;width:100%}
  .list{margin-top:18px}.preferences{max-width:620px}.preferences .subtle{font-size:13px}.choices{display:flex;gap:12px;flex-wrap:wrap}.choices button{border:1px solid #45515e;background:#252d36;border-radius:12px;color:#e4ebf2;padding:13px 18px}.choices button.chosen{border-color:var(--accent);color:var(--accent)}.secondary{background:transparent;color:#e4ebf2;border:1px solid #526070;border-radius:12px;padding:12px 18px}.error{background:#482932;border:1px solid #8e4b5f;color:#ffd6dc;padding:13px;border-radius:12px;margin-top:22px;display:flex;justify-content:space-between}.error button{border:0;background:none;color:inherit}
  .mobile-nav{display:none}.backdrop{position:fixed;inset:0;background:#000a;display:grid;place-items:center;z-index:20;padding:16px}.dialog{width:min(100%,520px);max-height:90vh;overflow-y:auto;background:#222a34;border:1px solid #48535f;border-radius:22px;padding:24px}.dialog form{display:grid;gap:16px;margin-top:16px}.dialog label{display:grid;gap:7px;font-size:13px;color:#b7c4d2}.dialog .qty-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.dialog input:focus,.dialog select:focus{outline:2px solid var(--accent)}
  @media(max-width:800px){.sidebar{display:none}main{padding:24px 18px 110px}.stats{gap:10px}.stat{padding:15px;border-radius:14px}.stat strong{font-size:26px}.panel{padding:16px}.mobile-nav{position:fixed;bottom:0;left:0;right:0;background:#1b212a;border-top:1px solid #343e49;display:flex;justify-content:space-around;z-index:10;padding:8px 5px max(10px,env(safe-area-inset-bottom))}.mobile-nav button{display:grid;justify-items:center;gap:4px;min-width:54px;border:0;background:none;color:#9cabb9;font-size:22px}.mobile-nav button small{font-size:10px}.mobile-nav button.active{color:var(--accent)}}
  @media(max-width:460px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.stats .stat:last-child{grid-column:span 2}.filters{flex-direction:column}.filters select{max-width:none}.dialog{padding:17px}.item{gap:9px}.beta{display:none}}
</style>
