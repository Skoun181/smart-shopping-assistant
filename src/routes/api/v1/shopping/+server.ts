import type { RequestHandler } from './$types';
import { randomUUID } from 'node:crypto';
import { database, now } from '$lib/server/db';
import { listItemBody, parsed, response } from '$lib/server/http';
import { changed } from '$lib/server/events';

export const GET: RequestHandler = () => {
  const db=database();
  return response({items: db.prepare("SELECT i.*, p.name_de, p.name_en, v.label_de AS variant_de, v.label_en AS variant_en FROM shopping_items i LEFT JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id WHERE i.list_id='default' ORDER BY i.checked ASC,i.sort_order DESC,i.created_at DESC").all()});
};
export const POST: RequestHandler = async (event) => {
  const value=await parsed(event,listItemBody);
  const db=database();
  const product = db.prepare('SELECT name_de FROM products WHERE id=? AND active=1').get(value.productId) as {name_de:string}|undefined;
  if (!product) return response({error:'Unknown product'},400);
  if (value.variantId && !db.prepare('SELECT 1 FROM product_variants WHERE id=? AND product_id=?').get(value.variantId,value.productId)) return response({error:'Invalid variant'},400);
  const t=now();
  const result=db.transaction(()=>{
    const duplicate = db.prepare("SELECT id,quantity FROM shopping_items WHERE list_id='default' AND checked=0 AND product_id=? AND variant_id IS ? AND unit_id=? AND note=? LIMIT 1")
      .get(value.productId,value.variantId??null,value.unitId,value.note) as {id:string;quantity:number}|undefined;
    if (duplicate) {
      const combined = duplicate.quantity + value.quantity;
      if (combined > 1000000) return {error:'Quantity too large'};
      db.prepare('UPDATE shopping_items SET quantity=?,version=version+1,updated_at=? WHERE id=?').run(combined,t,duplicate.id);
      return {id:duplicate.id,merged:true};
    }
    const id=randomUUID();
    db.prepare('INSERT INTO shopping_items(id,list_id,product_id,variant_id,name_snapshot,quantity,unit_id,note,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .run(id,'default',value.productId,value.variantId??null,product.name_de,value.quantity,value.unitId,value.note,t,t,t);
    return {id,merged:false};
  })();
  if ('error' in result) return response(result,400);
  changed('shopping');
  return response(result,201);
};
