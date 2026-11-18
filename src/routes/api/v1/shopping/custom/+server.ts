import type { RequestHandler } from './$types';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database, now } from '#lib/server/db.ts';
import { name, note, parsed, quantity, response } from '#lib/server/http.ts';
import { changed } from '#lib/server/events.ts';

const schema=z.object({
  nameDe:name,
  nameEn:name.optional(),
  categoryId:z.string().min(1).max(40),
  variantDe:z.string().trim().min(1).max(80).optional(),
  quantity,
  unitId:z.enum(['pcs','pack','g','kg','ml','l']),
  note:note.default('')
}).strict();

/**
 * Create a free-text product (or reuse a matching catalog product) and add it
 * to the shopping list in one SQLite transaction. No partially created products.
 */
export const POST: RequestHandler=async(event)=>{
  const input=await parsed(event,schema);
  const db=database();
  if(!db.prepare('SELECT 1 FROM categories WHERE id=?').get(input.categoryId))
    return response({error:'Unknown category'},400);

  const t=now();
  try {
    const result=db.transaction(()=>{
      const found=db.prepare('SELECT id,name_de FROM products WHERE name_de=? COLLATE NOCASE AND category_id=? AND active=1 LIMIT 1')
        .get(input.nameDe,input.categoryId) as {id:string;name_de:string}|undefined;
      const productId=found?.id??randomUUID();
      if(!found) db.prepare(
        "INSERT INTO products(id,category_id,name_de,name_en,source,active,created_at,updated_at) VALUES(?,?,?,?,'custom',1,?,?)"
      ).run(productId,input.categoryId,input.nameDe,input.nameEn??null,t,t);
      let variantId:string|null=null;
      if(input.variantDe){
        const variant=db.prepare('SELECT id FROM product_variants WHERE product_id=? AND label_de=? COLLATE NOCASE LIMIT 1')
          .get(productId,input.variantDe) as {id:string}|undefined;
        variantId=variant?.id??randomUUID();
        if(!variant)db.prepare('INSERT INTO product_variants(id,product_id,label_de,attributes) VALUES(?,?,?,?)')
          .run(variantId,productId,input.variantDe,'{}');
      }
      const duplicate=db.prepare(
        "SELECT id,quantity FROM shopping_items WHERE list_id='default' AND checked=0 AND product_id=? AND variant_id IS ? AND unit_id=? AND note=? LIMIT 1"
      ).get(productId,variantId,input.unitId,input.note) as {id:string;quantity:number}|undefined;
      if(duplicate){
        const next=Math.round((duplicate.quantity+input.quantity)*1000)/1000;
        if(next>1000000)throw new Error('Quantity too large');
        db.prepare('UPDATE shopping_items SET quantity=?,version=version+1,updated_at=? WHERE id=?')
          .run(next,t,duplicate.id);
        return {productId,itemId:duplicate.id,merged:true,createdProduct:!found};
      }
      const itemId=randomUUID();
      db.prepare(
        "INSERT INTO shopping_items(id,list_id,product_id,variant_id,name_snapshot,quantity,unit_id,note,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
      ).run(itemId,'default',productId,variantId,found?.name_de??input.nameDe,input.quantity,input.unitId,input.note,t,t,t);
      return {productId,itemId,merged:false,createdProduct:!found};
    })();
    if(result.createdProduct||input.variantDe)changed('catalog');
    changed('shopping');
    return response(result,201);
  } catch(cause) {
    if(cause instanceof Error&&cause.message==='Quantity too large')
      return response({error:'Quantity too large'},400);
    throw cause;
  }
};
