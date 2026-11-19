<script lang="ts">
  import { onMount } from 'svelte';
  import { categoryEmoji,productEmoji } from './product-emoji';
  import { nextQuantity,quantityStep } from '../pantry-controls';

  type Product = {id:string;category_id:string;name_de:string;name_en:string|null};
  type Category = {id:string;name_de:string;name_en:string};
  type Item = {
    id:string;product_id?:string|null;name_snapshot:string;name_de:string|null;name_en:string|null;
    variant_de:string|null;variant_en:string|null;quantity:number;unit_id:string;
    checked?:number;version:number;note?:string;
  };

  export let products:Product[];
  export let categories:Category[];
  export let items:Item[];
  export let lang:'de'|'en';
  export let onUpdate:(item:Item,body:Record<string,unknown>) => Promise<boolean>;
  export let onRemove:(item:Item) => void;

  const KEY='ssa:category-collapse:v1';
  let collapsed:Record<string,boolean>={};
  let pending:Record<string,boolean>={};
  const format=(v:number)=>new Intl.NumberFormat(lang,{maximumSignificantDigits:15}).format(v);
  const tr=(de:string,en:string)=>lang==='de'?de:en;
  const itemName=(item:Item)=>lang==='en'&&item.name_en?item.name_en:item.name_de||item.name_snapshot;
  const variantLabel=(item:Item)=>lang==='en'&&item.variant_en?item.variant_en:item.variant_de;
  const unitLabel=(value:string)=>({pcs:tr('Stk.','pcs'),pack:tr('Pkg.','pack'),g:'g',kg:'kg',ml:'ml',l:'l'}[value]||value);
  const productFor=(item:Item)=>products.find((p)=>p.id===item.product_id);
  const groupFor=(item:Item)=>productFor(item)?.category_id||'other';
  $: grouped=[
    ...categories.map((category)=>({
      id:category.id,emoji:categoryEmoji[category.id]||'🛒',
      label:lang==='de'?category.name_de:category.name_en,
      entries:items.filter((item)=>groupFor(item)===category.id)
    })).filter((group)=>group.entries.length>0),
    ...((items.some((item)=>groupFor(item)==='other'))?[{
      id:'other',emoji:'🛒',label:tr('Weitere Produkte','Other products'),
      entries:items.filter((item)=>groupFor(item)==='other')
    }]:[])
  ];
  onMount(()=>{
    try{collapsed=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{collapsed={};}
  });
  function toggle(id:string){
    collapsed={...collapsed,[id]:!collapsed[id]};
    localStorage.setItem(KEY,JSON.stringify(collapsed));
  }
  async function change(item:Item,body:Record<string,unknown>){
    if(pending[item.id])return false;
    pending={...pending,[item.id]:true};
    try{return await onUpdate(item,body);}finally{pending={...pending,[item.id]:false};}
  }
  async function check(item:Item,input:HTMLInputElement){
    if(!await change(item,{checked:!item.checked}))input.checked=!!items.find(i=>i.id===item.id)?.checked;
  }
  function step(item:Item,direction:-1|1){
    const next=nextQuantity(item.quantity,item.unit_id,direction);
    if(next>0&&next!==item.quantity&&!item.checked)void change(item,{quantity:next});
  }
  function edit(item:Item){
    if(item.checked||pending[item.id])return;
    const raw=prompt(tr('Neue Menge','New quantity'),String(item.quantity));
    if(raw===null || !raw.trim())return;
    const next=Number(raw.trim().replace(',','.'));
    if(Number.isFinite(next) && next>0 && next<=1000000)void change(item,{quantity:next});
    else alert(tr('Bitte eine gültige Menge eingeben.','Please enter a valid quantity.'));
  }
</script>

<div class="grouped" aria-label={tr('Einkaufsliste nach Kategorien','Shopping list by category')}>
  {#each grouped as group (group.id)}
    <section class="category">
      <button class="category-head" type="button" onclick={()=>toggle(group.id)} aria-expanded={!collapsed[group.id]}>
        <span class="cat-icon" aria-hidden="true">{group.emoji}</span>
        <span class="cat-label">{group.label}</span>
        <span class="counter">{group.entries.filter((item)=>!!item.checked).length}/{group.entries.length} {tr('erledigt','done')}</span>
        <span class="chevron" aria-hidden="true">{collapsed[group.id]?'›':'⌄'}</span>
      </button>
      {#if !collapsed[group.id]}
        <div class="cat-content">
          {#each group.entries as item (item.id)}
            <div class:checked={!!item.checked} class="row">
              <input type="checkbox" checked={!!item.checked} aria-label={tr('Als gekauft markieren: ','Mark purchased: ')+itemName(item)}
                disabled={pending[item.id]} onchange={(e)=>check(item,e.currentTarget)}/>
              <span class="emoji" aria-hidden="true">{productEmoji(productFor(item)?.name_de||item.name_de||item.name_snapshot,group.id)}</span>
              <div class="details">
                <strong>{itemName(item)}</strong>
                {#if variantLabel(item)||item.checked||item.note}<small>{[variantLabel(item),item.checked?tr('Gekauft','Purchased'):'',item.note].filter(Boolean).join(' · ')}</small>{/if}
              </div>
              <div class="controls">
                <button class="action step" type="button" disabled={!!item.checked||pending[item.id]||nextQuantity(item.quantity,item.unit_id,-1)===0} aria-label={itemName(item)+': '+tr('Menge reduzieren','Decrease quantity')+' '+format(quantityStep(item.unit_id))+' '+unitLabel(item.unit_id)} onclick={()=>step(item,-1)}>−</button>
                <button class="action qty" type="button" disabled={!!item.checked||pending[item.id]} title={tr('Menge bearbeiten','Edit quantity')} aria-label={itemName(item)+': '+tr('Menge bearbeiten','Edit quantity')} onclick={()=>edit(item)}>{format(item.quantity)} {unitLabel(item.unit_id)}</button>
                <button class="action step" type="button" disabled={!!item.checked||pending[item.id]||item.quantity>=1000000} aria-label={itemName(item)+': '+tr('Menge erhöhen','Increase quantity')+' '+format(quantityStep(item.unit_id))+' '+unitLabel(item.unit_id)} onclick={()=>step(item,1)}>+</button>
                <button class="action delete" type="button" disabled={pending[item.id]} title={tr('Entfernen','Delete')} aria-label={tr('Entfernen: ','Delete: ')+itemName(item)} onclick={()=>onRemove(item)}>×</button>
              </div>
            </div>
          {/each}
          <div class="progress" role="progressbar" aria-label={group.label} aria-valuemin="0" aria-valuemax={group.entries.length} aria-valuenow={group.entries.filter((item)=>!!item.checked).length}>
            <span style:width={group.entries.filter((item)=>!!item.checked).length/group.entries.length*100+'%'}></span>
          </div>
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
  .row:last-of-type{border-bottom:0}.row>input{width:21px;height:21px;flex-shrink:0;cursor:pointer;accent-color:var(--accent,#a7f3d0)}
  .emoji{font-size:24px;width:32px;line-height:1.4;text-align:center;flex-shrink:0}
  .details{flex:1;min-width:0}.details strong{font-size:14px;display:block;overflow-wrap:anywhere}.details small{display:block;margin-top:5px;font-size:12px;color:#a6b5c3;overflow-wrap:anywhere}
  .row.checked .details strong{text-decoration:line-through;color:#90a0ac}
  .action{border:1px solid #475765;border-radius:10px;color:#d7e1ea;background:#303c47;width:34px;height:34px;flex-shrink:0;font-size:16px}
  .action:hover{border-color:var(--accent,#a7f3d0)}.delete{color:#f5a4ac}
  .progress{background:#34404b;border-radius:99px;height:4px;margin-top:8px;overflow:hidden}
  .progress span{display:block;height:100%;border-radius:99px;background:var(--accent,#a7f3d0)}
  button:focus-visible,input:focus-visible{outline:2px solid var(--accent,#a7f3d0);outline-offset:2px}
  @media(max-width:540px){.category-head{padding:12px}.cat-content{padding:2px 11px 10px}.row{gap:8px}.emoji{width:27px;font-size:22px}.cat-label{font-size:14px}.counter{font-size:10px}.action{width:31px;height:31px}}
  .controls{display:flex;align-items:center;gap:6px;flex-shrink:0}.qty{width:auto;padding:0 6px;font-size:13px;font-weight:750;min-width:55px;font-variant-numeric:tabular-nums}.step{width:40px;height:40px;font-size:22px}.controls .action{min-height:40px}.action:disabled{opacity:.45;cursor:not-allowed}.row{flex-wrap:wrap}.details{min-width:90px}
  @media(max-width:540px){.controls{margin-left:auto}.controls .step,.controls .delete{width:38px;height:40px}.controls .qty{width:auto;min-width:48px}.details{min-width:80px}}
</style>