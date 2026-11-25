import type { RequestHandler } from './$types';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database, now } from '#lib/server/db.ts';
import { listItemBody, parsed, response, uuid } from '#lib/server/http.ts';
import { mergedQuantity } from '#lib/server/shopping-quantity.ts';
import { changed } from '#lib/server/events.ts';

const schema = z.object({
  items: z.array(listItemBody).min(1).max(250),
  operationId: uuid.optional()
}).strict();

type Input = z.infer<typeof listItemBody>;

/** Validate all references before writing anything: the entire multi-selection is atomic. */
export const POST: RequestHandler = async (event) => {
  const { items, operationId } = await parsed(event, schema, 64000);
  const db = database();
  const digest = createHash('sha256').update(JSON.stringify(items)).digest('hex');
  const lookup = db.prepare('SELECT name_de FROM products WHERE id=? AND active=1');
  const checkVariant = db.prepare('SELECT 1 FROM product_variants WHERE id=? AND product_id=?');
  const findDuplicate = db.prepare("SELECT id,quantity FROM shopping_items WHERE list_id='default' AND checked=0 AND product_id=? AND variant_id IS ? AND unit_id=? AND note=? LIMIT 1");
  const insert = db.prepare("INSERT INTO shopping_items(id,list_id,product_id,variant_id,name_snapshot,quantity,unit_id,note,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
  const update = db.prepare('UPDATE shopping_items SET quantity=?,version=version+1,updated_at=? WHERE id=?');
  try {
    const result = db.transaction(() => {
      if (operationId) {
        const previous = db.prepare('SELECT digest,added,merged FROM shopping_operations WHERE id=?').get(operationId) as
          {digest:string;added:number;merged:number} | undefined;
        if (previous) {
          if (previous.digest !== digest) throw new Error('Operation ID already used');
          return {added:previous.added,merged:previous.merged};
        }
      }
      const entries: Array<Input & { nameDe: string }> = [];
      for (const item of items) {
        const product = lookup.get(item.productId) as {name_de:string} | undefined;
        if (!product) throw new Error('Unknown product');
        if (item.variantId && !checkVariant.get(item.variantId,item.productId)) throw new Error('Invalid variant');
        entries.push({...item,nameDe:product.name_de});
      }
      const t = now();
      let added = 0, merged = 0;
      for (const item of entries) {
        const duplicate = findDuplicate.get(item.productId,item.variantId??null,item.unitId,item.note) as {id:string,quantity:number} | undefined;
        if (duplicate) {
          const next = mergedQuantity(duplicate.quantity, item.quantity);
          update.run(next,t,duplicate.id);
          merged++;
        } else {
          insert.run(randomUUID(),'default',item.productId,item.variantId??null,item.nameDe,item.quantity,item.unitId,item.note,t,t,t);
          added++;
        }
      }
      if(operationId){
        db.prepare('DELETE FROM shopping_operations WHERE created_at < ?').run(t - 7*24*60*60*1000);
        db.prepare('INSERT INTO shopping_operations(id,digest,added,merged,created_at) VALUES(?,?,?,?,?)').run(operationId,digest,added,merged,t);
      }
      return { added, merged };
    }).immediate();
    changed('shopping');
    return response(result,201);
  } catch(cause) {
    if (cause instanceof Error) {
      if(cause.message==='Operation ID already used')return response({error:cause.message},409);
      if(['Quantity too large','Unknown product','Invalid variant'].includes(cause.message))
        return response({error:cause.message},400);
    }
    throw cause;
  }
};
