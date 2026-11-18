export type PantryCategory={id:string;name_de:string;name_en:string};
export type PantryProduct={id:string;category_id:string;name_de:string;name_en:string|null};
export type PantryItem={
  id:string;product_id?:string|null;name_snapshot:string;name_de:string|null;name_en:string|null;
  variant_de:string|null;variant_en:string|null;quantity:number;unit_id:string;version:number;note?:string;
};
export function quantityStep(unit:string){
  return unit==='g'||unit==='ml'?100:unit==='kg'||unit==='l'?0.1:1;
}
export function nextQuantity(quantity:number,unit:string,direction:-1|1){
  const next=Number((quantity+quantityStep(unit)*direction).toPrecision(15));
  return Math.max(0,Math.min(1000000,next));
}
export function groupPantry(items:PantryItem[],products:PantryProduct[],categories:PantryCategory[],lang:'de'|'en'){
  const byProduct=new Map(products.map(p=>[p.id,p.category_id]));
  const valid=new Set(categories.map(c=>c.id));
  const buckets=new Map<string,PantryItem[]>();
  for(const item of items){
    const category=byProduct.get(item.product_id||'');
    const id=category&&valid.has(category)?category:'other';
    const bucket=buckets.get(id)||[];bucket.push(item);buckets.set(id,bucket);
  }
  return [...categories,{id:'other',name_de:'Weitere Produkte',name_en:'Other products'}].map(category=>({
    id:category.id,label:lang==='de'?category.name_de:category.name_en,
    entries:(buckets.get(category.id)||[]).sort((a,b)=>{
      const name=(item:PantryItem)=>lang==='en'&&item.name_en?item.name_en:item.name_de||item.name_snapshot;
      return name(a).localeCompare(name(b),lang);
    })
  })).filter(group=>group.entries.length>0);
}
