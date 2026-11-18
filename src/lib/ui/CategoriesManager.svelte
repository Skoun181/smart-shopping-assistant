<script lang="ts">
  import { productEmoji,categoryEmoji } from './product-emoji';

  type Product = {id:string;category_id:string;name_de:string;name_en:string|null;source:string};
  type Category = {id:string;name_de:string;name_en:string;sort_order?:number;is_custom?:number};

  export let products:Product[];
  export let categories:Category[];
  export let lang:'de'|'en';
  export let onCreate:(input:{nameDe:string;nameEn?:string})=>Promise<void>;
  export let onRename:(id:string,input:{nameDe:string;nameEn?:string})=>Promise<void>;
  export let onDelete:(id:string)=>Promise<void>;
  export let onMove:(productId:string,categoryId:string)=>Promise<void>;

  const tr=(de:string,en:string)=>lang==='de'?de:en;
  const productName=(p:Product)=>lang==='en'&&p.name_en?p.name_en:p.name_de;
  const categoryName=(c:Category)=>lang==='de'?c.name_de:c.name_en;
  let search='',newNameDe='',newNameEn='',editingId='',editingDe='',editingEn='';
  let working=false,workingProduct='',message='',notice='';
  let collapsed:Record<string,boolean>={};

  $: groups=categories.map((category)=>({
    category,
    items:products.filter((product)=>product.category_id===category.id &&
      (productName(product)+' '+product.name_de).toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()))
  })).filter((group)=>!search.trim()||group.items.length>0||categoryName(group.category).toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));

  async function create(event:SubmitEvent) {
    event.preventDefault();if(working)return;
    working=true;message='';notice='';
    try {
      await onCreate({nameDe:newNameDe.trim(),...(newNameEn.trim()?{nameEn:newNameEn.trim()}:{} )});
      newNameDe='';newNameEn='';
      notice=tr('Kategorie wurde erstellt. Jetzt kannst du Produkte hineinverschieben.','Category created. You can now move products into it.');
    }catch(e){message=String(e);}
    finally{working=false;}
  }
  async function move(product:Product,event:Event) {
    const select=event.currentTarget as HTMLSelectElement;
    const to=select.value;
    if(workingProduct || to===product.category_id)return;
    workingProduct=product.id;message='';notice='';
    try{await onMove(product.id,to);}
    catch(e){select.value=product.category_id;message=String(e);}
    finally{workingProduct='';}
  }
  function startEdit(category:Category){
    editingId=category.id;editingDe=category.name_de;editingEn=category.name_en;
  }
  async function rename(id:string){
    if(working||!editingDe.trim())return;
    working=true;message='';
    try{await onRename(id,{nameDe:editingDe.trim(),...(editingEn.trim()?{nameEn:editingEn.trim()}:{} )});editingId='';}
    catch(e){message=String(e);}
    finally{working=false;}
  }
  async function remove(category:Category,count:number){
    if(working || count>0)return;
    if(!confirm(tr('Kategorie wirklich löschen?','Delete this category?')))return;
    working=true;message='';notice='';
    try{await onDelete(category.id);}
    catch(e){message=String(e);}
    finally{working=false;}
  }
</script>

<div class="manager">
  <div class="head">
    <div>
      <h2>{tr('Deine Kategorien verwalten','Manage your categories')}</h2>
      <p>{tr('Ordne alle Produkte neu zu oder erstelle eigene Kategorien. Änderungen gelten für den gesamten Haushalt.','Reassign any product or create your own categories. Changes are shared across the household.')}</p>
    </div>
    <span class="count">{categories.length} {tr('Kategorien','categories')} · {products.length} {tr('Produkte','products')}</span>
  </div>

  <form class="create" onsubmit={create}>
    <div class="create-title"><span aria-hidden="true">✦</span> {tr('Neue Kategorie erstellen','Create a category')}</div>
    <div class="create-fields">
      <label>
        <span>{tr('Name auf Deutsch','German name')}</span>
        <input required maxlength="70" bind:value={newNameDe} placeholder={tr('z. B. Baby & Familie','e.g. Baby & family')}/>
      </label>
      <label>
        <span>{tr('Englisch (optional)','English (optional)')}</span>
        <input maxlength="70" bind:value={newNameEn} placeholder="Baby & family"/>
      </label>
      <button class="create-button" type="submit" disabled={working||!newNameDe.trim()}>＋ {tr('Erstellen','Create')}</button>
    </div>
  </form>
  <div class="search">
    <input type="search" bind:value={search} aria-label={tr('Produkte oder Kategorien suchen','Search products or categories')}
      placeholder={tr('Produkt oder Kategorie suchen …','Search products or categories …')}/>
  </div>
  {#if message}<p class="message error" role="alert">{message}</p>{/if}
  {#if notice}<p class="message success" role="status">{notice}</p>{/if}

  <div class="groups">
    {#each groups as group (group.category.id)}
      <section class="group">
        <div class="group-header">
          <button type="button" class="collapse" aria-expanded={!collapsed[group.category.id]} onclick={()=>collapsed={...collapsed,[group.category.id]:!collapsed[group.category.id]}}>
            <span aria-hidden="true" class="cat-emoji">{categoryEmoji[group.category.id]||'📦'}</span>
            <span class="title">{categoryName(group.category)}</span>
            <span class="count">{group.items.length} {tr('Produkte','products')}</span>
            <span aria-hidden="true" class="chevron">{collapsed[group.category.id]?'›':'⌄'}</span>
          </button>
          {#if group.category.is_custom}
            <button class="icon-button" type="button" title={tr('Kategorie umbenennen','Rename category')} onclick={()=>startEdit(group.category)}>✎</button>
            <button class="icon-button danger" type="button" disabled={working||products.some((p)=>p.category_id===group.category.id)}
              title={tr('Leere Kategorie löschen','Delete empty category')} onclick={()=>remove(group.category,group.items.length)}>×</button>
          {/if}
        </div>
        {#if editingId===group.category.id}
          <div class="edit-box">
            <label>{tr('Deutscher Name','German name')}<input required maxlength="70" bind:value={editingDe}/></label>
            <label>{tr('Englischer Name','English name')}<input maxlength="70" bind:value={editingEn}/></label>
            <button class="create-button" disabled={working||!editingDe.trim()} onclick={()=>rename(group.category.id)}>{tr('Speichern','Save')}</button>
            <button class="subtle-button" onclick={()=>editingId=''}>{tr('Abbrechen','Cancel')}</button>
          </div>
        {/if}
        {#if !collapsed[group.category.id]}
          <div class="products">
            {#each group.items as product (product.id)}
              <div class="product-row">
                <span class="prod-emoji" aria-hidden="true">{productEmoji(product.name_de,product.category_id)}</span>
                <div class="prod-info">
                  <strong>{productName(product)}</strong>
                  <small>{product.source==='custom'?tr('Eigenes Produkt','Custom product'):tr('Katalogprodukt','Catalog product')}</small>
                </div>
                <label class="move-label">
                  <span>{tr('Kategorie','Category')}</span>
                  <select disabled={!!workingProduct} value={product.category_id} aria-label={tr('Kategorie ändern für ','Change category for ')+productName(product)}
                    onchange={(event)=>move(product,event)}>
                    {#each categories as target (target.id)}
                      <option value={target.id}>{categoryName(target)}</option>
                    {/each}
                  </select>
                </label>
              </div>
            {/each}
            {#if !group.items.length}
              <p class="empty">{tr('Hier sind noch keine Produkte. Verschiebe welche über das Auswahlfeld einer anderen Kategorie hierher.','No products here yet. Move products here from another category.')}</p>
            {/if}
          </div>
        {/if}
      </section>
    {/each}
    {#if !groups.length}<p class="empty">{tr('Keine Ergebnisse gefunden.','No results found.')}</p>{/if}
  </div>
</div>
<style>
  .manager{display:grid;gap:18px;margin-top:24px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
  .head h2{margin:0 0 8px;font-size:21px}
  .head p{margin:0;color:#a5b5c3;font-size:13px;line-height:1.5;max-width:600px}
  .count{color:#b1c0ca;font-size:11px;white-space:nowrap}
  .head>.count{background:#27323c;padding:9px 11px;border-radius:10px}
  .create{border:1px solid #42505e;border-radius:17px;background:#202a32;padding:20px;display:grid;gap:14px}
  .create-title{font-weight:700;color:var(--accent,#a7f3d0)}
  .create-fields{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}
  label{min-width:0;display:grid;gap:5px;font-size:12px;color:#b8c6d2}
  input,select{background:#151c24;color:#ecf3f8;border:1px solid #526171;border-radius:10px;min-height:42px;padding:0 10px;font:inherit;width:100%;min-width:0}
  .create-button{background:var(--accent,#a7f3d0);color:var(--accent-ink,#112c28);border:0;border-radius:10px;padding:11px 15px;font-weight:760;min-height:42px}
  button:disabled{opacity:.45;cursor:not-allowed}
  .search input{width:100%;max-width:560px}
  .groups{display:grid;gap:13px}
  .group{border:1px solid #42505b;border-radius:16px;background:#222b34;overflow:hidden}
  .group-header{display:flex;align-items:stretch;background:#2b3540;gap:5px;padding-right:9px}
  .collapse{display:flex;align-items:center;gap:12px;flex:1;min-width:0;border:0;text-align:left;color:#f2f6fa;padding:13px 16px;background:transparent}
  .collapse:hover{background:#35414d}
  .cat-emoji{font-size:21px}
  .title{font-size:14px;font-weight:750;flex:1;min-width:0;overflow-wrap:anywhere}
  .chevron{font-size:22px;color:var(--accent,#a7f3d0);width:15px;text-align:center}
  .icon-button{background:#34414e;color:#dce5eb;border:1px solid #526171;border-radius:9px;align-self:center;min-width:32px;height:32px;font-size:16px}
  .icon-button.danger{color:#ffb3bb}
  .products{padding:2px 16px 10px}
  .product-row{display:flex;align-items:center;gap:12px;border-bottom:1px solid #394653;min-height:67px;padding:10px 0}
  .product-row:last-child{border:0}
  .prod-emoji{font-size:25px;width:34px;text-align:center;flex-shrink:0}
  .prod-info{flex:1;min-width:0;display:grid;gap:4px}
  .prod-info strong{font-size:13px;overflow-wrap:anywhere}
  .prod-info small{font-size:11px;color:#9aafbc}
  .move-label{width:min(45%,280px);flex-shrink:0}
  .move-label select{font-size:12px}
  .edit-box{padding:14px 16px;background:#24303a;display:flex;align-items:end;flex-wrap:wrap;gap:8px}
  .edit-box label{flex:1;min-width:140px}
  .subtle-button{background:none;color:#cbd9e3;border:1px solid #586773;min-height:42px;border-radius:10px;padding:0 12px}
  .empty{padding:15px;color:#a9bac8;font-size:13px}
  .message{border-radius:10px;padding:12px;margin:0;font-size:13px}
  .error{color:#ffbec7;background:#4d2931}.success{color:#baf5d8;background:#213e35}
  button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent,#a7f3d0);outline-offset:2px}
  @media(max-width:730px){.head{display:block}.head>.count{display:inline-block;margin-top:12px}.create-fields{grid-template-columns:1fr}.move-label{width:44%}.product-row{gap:7px}.prod-emoji{width:27px}}
  @media(max-width:410px){.move-label{width:46%}.products{padding:2px 10px}.collapse{padding:12px 8px}.group-header{gap:3px;padding-right:5px}.icon-button{min-width:29px}.product-row{gap:6px}}
</style>