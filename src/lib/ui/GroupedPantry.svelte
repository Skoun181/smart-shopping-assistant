<script lang="ts">
  import { onMount } from 'svelte';
  import { categoryEmoji,productEmoji } from './product-emoji';
  import { groupPantry,nextQuantity,quantityStep,type PantryItem,type PantryProduct,type PantryCategory } from '../pantry-controls';
  export let items:PantryItem[];
  export let products:PantryProduct[];
  export let categories:PantryCategory[];
  export let lang:'de'|'en';
  export let onQuantity:(item:PantryItem,quantity:number)=>Promise<void>;
  export let onRemove:(item:PantryItem)=>Promise<void>;
  const KEY='ssa:pantry-category-collapse:v1';
  let collapsed:Record<string,boolean>={};
  let pending:Record<string,boolean>={};
  let message='';
  const t=(de:string,en:string)=>lang==='de'?de:en;
  const itemName=(item:PantryItem)=>lang==='en'&&item.name_en?item.name_en:item.name_de||item.name_snapshot;
  const variant=(item:PantryItem)=>lang==='en'&&item.variant_en?item.variant_en:item.variant_de;
  const unit=(id:string)=>({pcs:t('Stk.','pcs'),pack:t('Pkg.','pack'),g:'g',kg:'kg',ml:'ml',l:'l'}[id]||id);
  const format=(v:number)=>new Intl.NumberFormat(lang,{maximumSignificantDigits:15}).format(v);
  $: grouped=groupPantry(items,products,categories,lang);
  onMount(()=>{
    try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))collapsed=saved;}catch{collapsed={};}
  });
  function saveCollapse(next:Record<string,boolean>){collapsed=next;try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* storage may be disabled */}}
  function all(value:boolean){saveCollapse(Object.fromEntries(grouped.map(g=>[g.id,value])));}
  async function change(item:PantryItem,quantity:number){
    if(pending[item.id]||quantity===item.quantity)return;
    pending={...pending,[item.id]:true};message='';
    try{await onQuantity(item,quantity);}
    catch(e){message=t('Änderung nicht gespeichert. Bitte prüfe den aktualisierten Bestand. ','Change not saved. Check the refreshed stock. ')+(e instanceof Error?e.message:'');}
    finally{pending={...pending,[item.id]:false};}
  }
  async function remove(item:PantryItem){
    if(pending[item.id])return;
    pending={...pending,[item.id]:true};message='';
    try{await onRemove(item);}
    catch(e){message=t('Entfernen fehlgeschlagen. Bitte erneut prüfen.','Removal failed. Please review again.');}
    finally{pending={...pending,[item.id]:false};}
  }
  function edit(item:PantryItem){
    const raw=prompt(t('Neue Menge','New quantity'),String(item.quantity));if(raw===null||!raw.trim())return;
    const value=Number(raw.trim().replace(',','.'));
    if(Number.isFinite(value)&&value>=0&&value<=1000000)void change(item,value);
    else message=t('Bitte eine gültige Menge von 0 bis 1.000.000 eingeben.','Enter a valid quantity between 0 and 1,000,000.');
  }
</script>
<div class="grouped" aria-label={t('Vorräte nach Kategorien','Pantry by category')}>
  <div class="tools"><button type="button" onclick={()=>all(false)}>{t('Alle öffnen','Expand all')}</button><button type="button" onclick={()=>all(true)}>{t('Alle schließen','Collapse all')}</button></div>
  <p class="step-hint">{t('Schnell ändern: ±1 Stück/Packung, ±100 g/ml oder ±0,1 kg/l. Auf die Menge tippen, um einen genauen Wert einzugeben.','Quick adjust: ±1 piece/pack, ±100 g/ml or ±0.1 kg/l. Tap the quantity for an exact value.')}</p>
  {#if message}<p class="notice" role="alert">{message}</p>{/if}
  {#each grouped as group (group.id)}
    <section class="category">
      <button class="category-head" type="button" aria-expanded={!collapsed[group.id]} onclick={()=>saveCollapse({...collapsed,[group.id]:!collapsed[group.id]})}>
        <span class="cat-icon" aria-hidden="true">{categoryEmoji[group.id]||'📦'}</span><span class="cat-label">{group.label}</span>
        <span class="counter">{group.entries.length} {t('Positionen','entries')}</span><span class="chevron" aria-hidden="true">{collapsed[group.id]?'›':'⌄'}</span>
      </button>
      {#if !collapsed[group.id]}
        <div class="cat-content">
          {#each group.entries as item(item.id)}
            <div class="row">
              <span class="emoji" aria-hidden="true">{productEmoji(item.name_de||item.name_snapshot,group.id)}</span>
              <div class="details"><strong>{itemName(item)}</strong>{#if variant(item)}<small>{variant(item)}</small>{/if}</div>
              <div class="controls">
                <button class="action step" type="button" disabled={pending[item.id]} aria-label={itemName(item)+': '+t('verbrauchen','consume')+' '+format(quantityStep(item.unit_id))+' '+unit(item.unit_id)} onclick={()=>change(item,nextQuantity(item.quantity,item.unit_id,-1))}>−</button>
                <button class="action qty" style="width:auto;padding:0 6px" type="button" disabled={pending[item.id]} title={t('Menge bearbeiten','Edit quantity')} aria-label={itemName(item)+': '+t('Menge bearbeiten','Edit quantity')} onclick={()=>edit(item)}>{format(item.quantity)} {unit(item.unit_id)}</button>
                <button class="action step" type="button" disabled={pending[item.id]||item.quantity>=1000000} aria-label={itemName(item)+': '+t('erhöhen','increase')+' '+format(quantityStep(item.unit_id))+' '+unit(item.unit_id)} onclick={()=>change(item,nextQuantity(item.quantity,item.unit_id,1))}>+</button>
                <button class="action delete" type="button" disabled={pending[item.id]} aria-label={t('Entfernen: ','Delete: ')+itemName(item)} onclick={()=>remove(item)}>×</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/each}
</div>
<style>
  .grouped{display:grid;gap:13px;margin-top:18px}
  .category{border:1px solid #3b4653;border-radius:16px;overflow:hidden;background:#212932}
  .category-head{width:100%;background:#29333e;color:#eff5f8;padding:15px 17px;display:flex;gap:12px;align-items:center;border:0;text-align:left}
  .category-head:hover{background:#33404c}.cat-icon{font-size:21px}.cat-label{font-size:15px;font-weight:760;flex:1}
  .counter{font-size:11px;color:#b9c6d2;white-space:nowrap}.chevron{font-size:24px;line-height:1;color:var(--accent,#a7f3d0);width:18px;text-align:center}
  .cat-content{padding:2px 17px 10px}.row{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #374450;min-height:60px}
  .row:last-of-type{border-bottom:0}
  .emoji{font-size:24px;width:32px;line-height:1.4;text-align:center;flex-shrink:0}
  .details{flex:1;min-width:0}.details strong{font-size:14px;display:block;overflow-wrap:anywhere}.details small{display:block;margin-top:5px;font-size:12px;color:#a6b5c3;overflow-wrap:anywhere}
  .action{border:1px solid #475765;border-radius:10px;color:#d7e1ea;background:#303c47;width:34px;height:34px;flex-shrink:0;font-size:16px}
  .action:hover{border-color:var(--accent,#a7f3d0)}.delete{color:#f5a4ac}
  button:focus-visible{outline:2px solid var(--accent,#a7f3d0);outline-offset:2px}
  @media(max-width:540px){.category-head{padding:12px}.cat-content{padding:2px 11px 10px}.row{gap:8px}.emoji{width:27px;font-size:22px}.cat-label{font-size:14px}.counter{font-size:10px}.action{width:31px;height:31px}}
.controls{display:flex;align-items:center;gap:6px;flex-shrink:0}.qty{font-size:13px;font-weight:750;color:#edf4f8;min-width:55px;text-align:center;font-variant-numeric:tabular-nums}.step{width:40px;height:40px;font-size:22px}.action:disabled{opacity:.45;cursor:not-allowed}.notice{color:#ffb6be;font-size:13px;margin:10px 0}.tools{display:flex;justify-content:flex-end;gap:8px}.tools button{background:#29333e;border:1px solid #475765;color:#d7e1ea;border-radius:9px;padding:8px 11px;font-size:12px}.step-hint{font-size:12px;color:#a6b5c3;margin:0}.row{flex-wrap:wrap}.controls .action{min-height:40px}.details{min-width:90px}
@media(max-width:540px){.row{gap:8px}.controls{margin-left:auto}.controls .action{width:38px;height:40px}.qty{min-width:48px}.category-head{min-height:48px}.details{min-width:80px}}
</style>