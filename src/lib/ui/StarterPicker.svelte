<script lang="ts">
  import { modalFocus } from './modal-focus';
  import { operationId } from './operation-id';
  import { categoryEmoji, productEmoji, defaultUnit } from './product-emoji';

  type Product = {id:string;category_id:string;name_de:string;name_en:string|null;brand:string|null};
  type Category = {id:string;name_de:string;name_en:string};
  type Variant = {id:string;product_id:string;label_de:string;label_en:string|null};
  type Choice = {quantity:number;unitId:'pcs'|'pack'|'g'|'kg'|'ml'|'l';variantId:string};

  export let products: Product[];
  export let categories: Category[];
  export let variants: Variant[];
  export let lang:'de'|'en';
  export let initial = false;
  export let onClose: () => void;
  export let onCustom: (name: string) => void;
  export let onSave: (items: Array<{productId:string;quantity:number;unitId:string;variantId:string|null;note:string}>, operationId:string) => Promise<void>;

  const tr = (de:string,en:string) => lang === 'de' ? de : en;
  const displayName = (product:Product) => lang === 'en' && product.name_en ? product.name_en : product.name_de;
  const variantName = (variant:Variant) => lang === 'en' && variant.label_en ? variant.label_en : variant.label_de;
  const unitLabel = (value:string) => ({
    pcs: tr('Stück','pieces'), pack: tr('Packungen','packs'), g:'g', kg:'kg', ml:'ml', l:'l'
  }[value] ?? value);
  let search='';
  let choices:Record<string,Choice>={};
  let collapsed:Record<string,boolean>={};
  let saving=false;
  let message='';
  $: selectedCount = Object.keys(choices).length;
  $: filtered = products.filter((p) => (displayName(p)+' '+p.name_de+' '+(p.brand??'')).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  $: groups = categories.map((c) => ({ category:c, items:filtered.filter((p) => p.category_id === c.id) })).filter((group)=>group.items.length>0);
  $: valid = selectedCount > 0 && Object.values(choices).every((choice)=>Number.isFinite(choice.quantity) && choice.quantity>0 && choice.quantity<=1000000);

  function toggle(product:Product) {
    if (choices[product.id]) {
      const next={...choices};delete next[product.id];choices=next;
    } else {
      choices={...choices,[product.id]:{quantity:1,unitId:defaultUnit(product.category_id,product.name_de),variantId:''}};
    }
  }
  function update(id:string,patch:Partial<Choice>){
    choices={...choices,[id]:{...choices[id],...patch}};
  }
  function toggleGroup(id:string){collapsed={...collapsed,[id]:!collapsed[id]};}
  let lastSubmission: {payload:string;id:string}|undefined;
  async function save(){
    if (!valid || saving) return;
    saving=true;message='';
    try{
      const items=Object.entries(choices).map(([productId,choice])=>({
        productId,quantity:choice.quantity,unitId:choice.unitId,variantId:choice.variantId||null,note:''
      }));
      const payload=JSON.stringify(items);
      if(lastSubmission?.payload!==payload)lastSubmission={payload,id:operationId()};
      await onSave(items,lastSubmission.id);
    }catch(cause){
      message=tr('Die Produkte konnten nicht gespeichert werden. Bitte erneut versuchen.','Products could not be saved. Please try again.')
        +' '+(cause instanceof Error?cause.message:'');
    }finally{saving=false;}
  }
</script>

<div class="scrim">
  <div use:modalFocus={()=>{if(!saving)onClose();}} role="dialog" aria-modal="true" aria-labelledby="starter-title" aria-describedby="starter-desc" class="picker">
    <header class="picker-header">
      <div class="hero">
        <span class="hero-emoji" aria-hidden="true">🛒</span>
        <div>
          <p class="eyebrow">{initial?tr('WILLKOMMEN ZU HAUSE','WELCOME HOME'):tr('SCHNELL HINZUFÜGEN','QUICK ADD')}</p>
          <h2 id="starter-title">{initial?tr('Was brauchst du zuerst?','What do you need first?'):tr('Produkte auswählen','Choose products')}</h2>
          <p id="starter-desc">{tr('Tippe mehrere Produktkacheln an – wie beim Auswählen von Fotos.','Tap multiple product tiles, just like selecting photos.')}</p>
        </div>
      </div>
      <button class="close" type="button" onclick={onClose} disabled={saving} aria-label={tr('Schließen','Close')}>✕</button>
    </header>
    <div class="searchbar">
      <span aria-hidden="true">⌕</span>
      <input data-initial-focus bind:value={search} type="search" autocomplete="off"
        placeholder={tr('Alle Produkte durchsuchen, z. B. Milch …','Search all products, e.g. Milk …')}
        aria-label={tr('Produkte suchen','Search products')}/>
      <span class="total">{filtered.length} {tr('Produkte','products')}</span>
    </div>
    <div class="free-entry">
      <span>{tr('Produkt fehlt im Katalog?','Can’t find a product?')}</span>
      <button type="button" onclick={()=>onCustom(search.trim())}>
        ✎ {search.trim()?tr('„'+search.trim().slice(0,50)+'“ selbst hinzufügen','Add “'+search.trim().slice(0,50)+'” manually'):tr('Eigenes Produkt frei eingeben','Enter any product manually')}
      </button>
    </div>
    <div class="picker-scroll">
      {#each groups as group (group.category.id)}
        <section class="category-block">
          <button type="button" class="category-toggle" aria-expanded={search.trim()?true:!collapsed[group.category.id]} onclick={()=>toggleGroup(group.category.id)}>
            <span class="category-icon" aria-hidden="true">{categoryEmoji[group.category.id] || '🛒'}</span>
            <span class="category-title">{lang==='de'?group.category.name_de:group.category.name_en}</span>
            <span class="category-count">{group.items.filter((p)=>!!choices[p.id]).length}/{group.items.length}</span>
            <span class="caret" aria-hidden="true">{search.trim() || !collapsed[group.category.id]?'⌄':'›'}</span>
          </button>
          {#if search.trim() || !collapsed[group.category.id]}
            <div class="tiles">
              {#each group.items as product (product.id)}
                <article class:selected={!!choices[product.id]} class="tile">
                  <button type="button" class="tile-button" aria-pressed={!!choices[product.id]}
                    aria-label={displayName(product)+' – '+(choices[product.id]?tr('ausgewählt','selected'):tr('auswählen','select'))}
                    onclick={()=>toggle(product)}>
                    <span class="check" aria-hidden="true">{choices[product.id]?'✓':'+'}</span>
                    <span class="illustration" aria-hidden="true">{productEmoji(product.name_de,product.category_id)}</span>
                    <span class="product-name">{displayName(product)}</span>
                    {#if product.brand}<span class="brand">{product.brand}</span>{/if}
                  </button>
                  {#if choices[product.id]}
                    <div class="tile-options">
                      <label>
                        <span>{tr('Menge','Qty')}</span>
                        <input type="number" required min="0.001" max="1000000" step="any"
                          value={choices[product.id].quantity}
                          oninput={(event)=>update(product.id,{quantity:Number(event.currentTarget.value)})}/>
                      </label>
                      <label>
                        <span>{tr('Einheit','Unit')}</span>
                        <select value={choices[product.id].unitId}
                          onchange={(event)=>update(product.id,{unitId:event.currentTarget.value as Choice['unitId']})}>
                          {#each ['pcs','pack','g','kg','ml','l'] as value}
                            <option value={value}>{unitLabel(value)}</option>
                          {/each}
                        </select>
                      </label>
                      {#if variants.some((v)=>v.product_id===product.id)}
                        <label class="variant-field">
                          <span>{tr('Variante (optional)','Variant (optional)')}</span>
                          <select value={choices[product.id].variantId}
                            onchange={(event)=>update(product.id,{variantId:event.currentTarget.value})}>
                            <option value="">{tr('Standard','Standard')}</option>
                            {#each variants.filter((v)=>v.product_id===product.id) as variant (variant.id)}
                              <option value={variant.id}>{variantName(variant)}</option>
                            {/each}
                          </select>
                        </label>
                      {/if}
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
      {#if groups.length===0}<p class="no-results">{tr('Keine Produkte gefunden. Versuche einen anderen Suchbegriff.','No products found. Try another search.')}</p>{/if}
    </div>
    <footer>
      <div class="selection">
        <strong>{selectedCount} {selectedCount===1?tr('Produkt','product'):tr('Produkte','products')}</strong>
        <span>{tr('ausgewählt','selected')}</span>
      </div>
      <div class="footer-actions">
        {#if selectedCount>0}<button type="button" class="clear" disabled={saving} onclick={()=>choices={}}>{tr('Auswahl löschen','Clear')}</button>{/if}
        <button type="button" class="skip" disabled={saving} onclick={onClose}>{initial?tr('Später','Not now'):tr('Abbrechen','Cancel')}</button>
        <button type="button" class="save" disabled={!valid||saving} onclick={save}>
          {saving?tr('Wird gespeichert …','Saving …'):tr('Zur Liste hinzufügen','Add to list')+' · '+selectedCount}
        </button>
      </div>
      {#if message}<p class="alert" role="alert">{message}</p>{/if}
    </footer>
  </div>
</div>

<style>
  .scrim{position:fixed;inset:0;background:rgba(2,6,13,.84);backdrop-filter:blur(7px);z-index:35;display:grid;place-items:center;padding:14px;color:#edf5f8}
  .picker{background:#1d242d;border:1px solid #44515e;border-radius:24px;box-shadow:0 22px 90px #0009;width:min(100%,1100px);max-height:calc(100dvh - 28px);min-height:min(740px,calc(100dvh - 28px));display:flex;flex-direction:column;overflow:hidden}
  .picker-header{padding:26px 28px 18px;display:flex;align-items:flex-start;gap:12px;justify-content:space-between;flex-shrink:0}
  .hero{display:flex;gap:15px;align-items:center}.hero-emoji{font-size:34px;background:var(--accent-soft,#284239);border-radius:16px;padding:14px}
  .eyebrow{font-size:11px;font-weight:800;letter-spacing:1.6px;color:var(--accent,#a7f3d0);margin:0 0 6px}
  h2{font-size:clamp(20px,2.4vw,28px);letter-spacing:-.6px;margin:0 0 7px}#starter-desc{margin:0;color:#aebcc8;font-size:13px;line-height:1.4}
  .close{border:1px solid #526070;color:#d9e3eb;background:#303a45;border-radius:12px;width:40px;height:40px;font-size:18px;flex-shrink:0}
  .searchbar{margin:0 28px 16px;background:#141b23;border:1px solid #556372;border-radius:14px;display:flex;align-items:center;gap:9px;padding:0 12px;min-height:50px;flex-shrink:0}
  .searchbar>span:first-child{font-size:25px;color:#8ca4b5}.searchbar input{flex:1;min-width:0;border:0;outline:0;color:#f3f7fa;background:transparent;font:inherit;font-size:14px}
  .searchbar input:focus-visible{outline:2px solid var(--accent,#a7f3d0);outline-offset:4px}
  .total{color:#91a1b2;white-space:nowrap;font-size:12px}
  .free-entry{margin:0 28px 13px;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#acc0cd;font-size:12px}
  .free-entry button{border:1px solid var(--accent,#a7f3d0);border-radius:10px;background:#273941;color:var(--accent,#a7f3d0);font-size:12px;font-weight:700;padding:8px 10px}
  .picker-scroll{overflow-y:auto;overscroll-behavior:contain;padding:0 28px 22px;flex:1;min-height:0}
  .category-block{margin-bottom:16px}.category-toggle{display:flex;align-items:center;gap:12px;color:#edf4f9;background:#28313a;border:1px solid #465361;border-radius:12px;width:100%;padding:13px 16px;text-align:left}
  .category-icon{font-size:21px}.category-title{font-weight:750;flex:1;font-size:14px}
  .category-count{font-size:12px;color:var(--accent,#a7f3d0);background:#1c252d;border-radius:9px;padding:5px 9px}
  .caret{font-size:24px;line-height:1;color:#9fb0bd}
  .tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding-top:12px}
  .tile{position:relative;border:1px solid #40505c;border-radius:16px;min-width:0;overflow:hidden;background:#252e38}
  .tile.selected{border-color:var(--accent,#a7f3d0);background:#2b3b41;box-shadow:inset 0 0 0 1px var(--accent,#a7f3d0)}
  .tile-button{padding:17px 10px 14px;color:#f5f8fa;border:0;display:grid;justify-items:center;gap:7px;width:100%;background:transparent;position:relative;min-height:130px;text-align:center}
  .tile-button:hover{background:#36404c}.check{position:absolute;top:8px;right:8px;display:grid;place-items:center;width:25px;height:25px;border:1px solid #677887;border-radius:50%;font-weight:800;font-size:16px;background:#34424e;color:#b8c9d7}
  .selected .check{background:var(--accent,#a7f3d0);color:#152721;border-color:var(--accent,#a7f3d0)}
  .illustration{font-size:38px;line-height:1.4;filter:drop-shadow(0 3px 7px #0003)}
  .product-name{font-weight:700;font-size:13px;line-height:1.35;overflow-wrap:anywhere}
  .brand{font-size:11px;color:#a9b6c3}
  .tile-options{padding:9px 10px 12px;border-top:1px solid #4a646c;display:grid;grid-template-columns:1fr 1fr;gap:8px}
  label{display:grid;gap:4px;min-width:0}label span{color:#c1d2d9;font-size:11px}
  label input,label select{width:100%;min-width:0;color:#f7fbfd;background:#19262d;border:1px solid #5b727b;border-radius:7px;height:35px;font:inherit;font-size:12px;padding:0 7px}
  .variant-field{grid-column:span 2}
  .no-results{padding:30px;text-align:center;color:#b4bdc7}
  footer{padding:15px 28px;background:#192129;border-top:1px solid #3b4751;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;flex-shrink:0}
  .selection{display:grid;gap:2px;white-space:nowrap}.selection strong{font-size:18px;color:var(--accent,#a7f3d0)}.selection span{font-size:11px;color:#a9b9c5}
  .footer-actions{display:flex;align-items:center;gap:9px;margin-left:auto}
  .footer-actions button{min-height:42px;border-radius:11px;padding:9px 14px;border:1px solid #566574;background:#2a3540;color:#e2edf4;font-weight:650;font-size:13px}
  .footer-actions .clear{border:0;background:transparent;color:#b9ccd8}
  .footer-actions .save{background:var(--accent,#a7f3d0);color:var(--accent-ink,#112c28);border-color:var(--accent,#a7f3d0)}
  .footer-actions .save:disabled{opacity:.45;cursor:not-allowed}.alert{color:#ffb6b6;width:100%;font-size:13px;margin:0}
  button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--accent,#a7f3d0);outline-offset:2px}
  @media(max-width:820px){.free-entry{margin:0 18px 10px}}
  @media(max-width:820px){.tiles{grid-template-columns:repeat(3,minmax(0,1fr))}.picker-header{padding:20px 18px 14px}.searchbar{margin:0 18px 12px}.picker-scroll{padding:0 18px 14px}footer{padding:13px 18px}}
  @media(max-width:580px){.free-entry{align-items:stretch;flex-direction:column}}
  @media(max-width:580px){.scrim{padding:0}.picker{width:100%;height:100dvh;max-height:100dvh;min-height:0;border-radius:0}.hero-emoji{font-size:23px;padding:11px}.picker-header{gap:8px}.tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.tile-button{min-height:113px;padding:14px 6px 10px}.illustration{font-size:31px}.product-name{font-size:12px}.tile-options{gap:5px;padding:7px}.total{display:none}.footer-actions{width:100%;justify-content:flex-end}.footer-actions .clear{margin-right:auto}.selection{display:flex;align-items:baseline;gap:6px}footer{gap:7px}.category-toggle{padding:10px 12px}}
</style>
