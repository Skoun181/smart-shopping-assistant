import type { RequestHandler } from './$types';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database, now } from '#lib/server/db.ts';
import { listItemBody, parsed, response } from '#lib/server/http.ts';
import { changed } from '#lib/server/events.ts';

const schema = z.object({
  items: z.array(listItemBody).min(1).max(250)
}).strict();

type Input = z.infer<typeof listItemBody>;

/** Validate all references before writing anything: the entire multi-selection is atomic. */
export const POST: RequestHandler = async (event) => {
  const { items } = await parsed(event, schema, 64000);
  const db = database();
  const lookup = db.prepare('SELECT name_de FROM products WHERE id=? AND active=1');
  const checkVariant = db.prepare('SELECT 1 FROM product_variants WHERE id=? AND product_id=?');
  const findDuplicate = db.prepare("SELECT id,quantity FROM shopping_items WHERE list_id='default' AND checked=0 AND product_id=? AND variant_id IS ? AND unit_id=? AND note=? LIMIT 1");
  const insert = db.prepare("INSERT INTO shopping_items(id,list_id,product_id,variant_id,name_snapshot,quantity,unit_id,note,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
  const update = db.prepare('UPDATE shopping_items SET quantity=?,version=version+1,updated_at=? WHERE id=?');
  const entries: Array<Input & { nameDe: string }> = [];
  for (const item of items) {
    const product = lookup.get(item.productId) as {name_de:string} | undefined;
    if (!product) return response({error:'Unknown product'},400);
    if (item.variantId && !checkVariant.get(item.variantId,item.productId)) return response({error:'Invalid variant'},400);
    entries.push({...item,nameDe:product.name_de});
  }
  const t = now();
  try {
    const result = db.transaction(() => {
      let added = 0, merged = 0;
      for (const item of entries) {
        const duplicate = findDuplicate.get(item.productId,item.variantId??null,item.unitId,item.note) as {id:string,quantity:number} | undefined;
        if (duplicate) {
          const next = Math.round((duplicate.quantity + item.quantity) * 1000) / 1000;
          if (next > 1000000) throw new Error('Quantity too large');
          update.run(next,t,duplicate.id);
          merged++;
        } else {
          insert.run(randomUUID(),'default',item.productId,item.variantId??null,item.nameDe,item.quantity,item.unitId,item.note,t,t,t);
          added++;
        }
      }
      return { added, merged };
    })();
    changed('shopping');
    return response(result,201);
  } catch(cause) {
    if (cause instanceof Error && cause.message === 'Quantity too large') return response({error:cause.message},400);
    throw cause;
  }
};
