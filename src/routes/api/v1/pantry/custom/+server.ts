import type { RequestHandler } from './$types';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database, now } from '#lib/server/db.ts';
import { name, parsed, quantity, response } from '#lib/server/http.ts';
import { changed } from '#lib/server/events.ts';

const schema=z.object({
  nameDe:name,
  nameEn:name.optional(),
  categoryId:z.string().min(1).max(40),
  variantDe:z.string().trim().min(1).max(80).optional(),
  locationId:z.string().min(1).max(40).default('home'),
  quantity,
  unitId:z.enum(['pcs','pack','g','kg','ml','l'])
}).strict();

/** Store the new free-text product and its initial pantry entry atomically. */
export const POST:RequestHandler=async(event)=>{
  const input=await parsed(event,schema);
  const db=database();
  if(!db.prepare('SELECT 1 FROM categories WHERE id=?').get(input.categoryId))
    return response({error:'Unknown category'},400);
  if(!db.prepare('SELECT 1 FROM pantry_locations WHERE id=?').get(input.locationId))
    return response({error:'Unknown location'},400);
  const t=now();
  const result=db.transaction(()=>{
    const found=db.prepare('SELECT id,name_de FROM products WHERE name_de=? COLLATE NOCASE AND category_id=? AND active=1 LIMIT 1')
      .get(input.nameDe,input.categoryId) as {id:string;name_de:string}|undefined;
    const productId=found?.id??randomUUID();
    if(!found)db.prepare("INSERT INTO products(id,category_id,name_de,name_en,source,active,created_at,updated_at) VALUES(?,?,?,?,'custom',1,?,?)")
      .run(productId,input.categoryId,input.nameDe,input.nameEn??null,t,t);
    let variantId:string|null=null;
    if(input.variantDe){
      const variant=db.prepare('SELECT id FROM product_variants WHERE product_id=? AND label_de=? COLLATE NOCASE LIMIT 1')
        .get(productId,input.variantDe) as {id:string}|undefined;
      variantId=variant?.id??randomUUID();
      if(!variant) db.prepare('INSERT INTO product_variants(id,product_id,label_de,attributes) VALUES(?,?,?,?)')
        .run(variantId,productId,input.variantDe,'{}');
    }
    const id=randomUUID();
    db.prepare('INSERT INTO pantry_items(id,location_id,product_id,variant_id,name_snapshot,quantity,unit_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id,input.locationId,productId,variantId,found?.name_de??input.nameDe,input.quantity,input.unitId,t,t);
    return {id,productId,createdProduct:!found};
  })();
  if(result.createdProduct||input.variantDe)changed('catalog');
  changed('pantry');
  return response(result,201);
};
