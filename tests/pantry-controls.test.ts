import { describe,expect,test } from 'vitest';
import { groupPantry,nextQuantity,quantityStep } from '../src/lib/pantry-controls';
describe('pantry controls',()=>{
  test('counts and metric units use predictable steps without negative stock',()=>{
    expect(nextQuantity(6,'pcs',-1)).toBe(5);
    expect(nextQuantity(2,'pack',1)).toBe(3);
    expect(nextQuantity(1,'pcs',-1)).toBe(0);
    expect(nextQuantity(0.05,'l',-1)).toBe(0);
    expect(nextQuantity(0.3,'kg',-1)).toBe(0.2);
    expect(nextQuantity(350,'g',-1)).toBe(250);
    expect(quantityStep('ml')).toBe(100);
    expect(nextQuantity(999999.99,'kg',1)).toBe(1000000);
  });
  test('grouping follows current category assignment and preserves unknown products',()=>{
    const categories=[{id:'dairy',name_de:'Milchprodukte',name_en:'Dairy'},{id:'custom',name_de:'Mein Regal',name_en:'My shelf'}];
    const products=[{id:'milk',name_de:'Milch',name_en:'Milk',category_id:'dairy'}];
    const item={id:'1',product_id:'milk',name_snapshot:'Milch',name_de:'Milch',name_en:'Milk',variant_de:null,variant_en:null,quantity:2,unit_id:'l',version:1};
    const items=[item,{...item,id:'2',product_id:null,name_snapshot:'Unbekannt',name_de:null,name_en:null}];
    expect(groupPantry(items,products,categories,'de').map(g=>g.id)).toEqual(['dairy','other']);
    expect(groupPantry(items,[{...products[0],category_id:'custom'}],categories,'de').map(g=>g.id)).toEqual(['custom','other']);
  });
});
