import type { RequestHandler } from './$types';
import { randomUUID } from 'node:crypto';
import { database, now } from '$lib/server/db';
import { pantryBody, parsed, response } from '$lib/server/http';
import { changed } from '$lib/server/events';
export const GET: RequestHandler = () => {
  const db=database();
  return response({
    locations:db.prepare('SELECT * FROM pantry_locations').all(),
    items:db.prepare('SELECT i.*,p.name_de,p.name_en,v.label_de AS variant_de,v.label_en AS variant_en FROM pantry_items i LEFT JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id ORDER BY i.updated_at DESC').all()
  });
};
export const POST: RequestHandler = async (event) => {
  const value=await parsed(event,pantryBody);
  const db=database(), t=now(), id=randomUUID();
  const product=db.prepare('SELECT name_de FROM products WHERE id=? AND active=1').get(value.productId) as {name_de:string}|undefined;
  if (!product) return response({error:'Unknown product'},400);
  if (value.variantId && !db.prepare('SELECT 1 FROM product_variants WHERE id=? AND product_id=?').get(value.variantId,value.productId)) return response({error:'Invalid variant'},400);
  if (!db.prepare('SELECT 1 FROM pantry_locations WHERE id=?').get(value.locationId)) return response({error:'Invalid location'},400);
  db.prepare('INSERT INTO pantry_items(id,location_id,product_id,variant_id,name_snapshot,quantity,unit_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(id,value.locationId,value.productId,value.variantId??null,product.name_de,value.quantity,value.unitId,t,t);
  changed('pantry');
  return response({id},201);
};
