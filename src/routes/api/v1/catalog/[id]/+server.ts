import type { RequestHandler } from './$types';
import { z } from 'zod';
import { database, now } from '#lib/server/db.ts';
import { parsed, response, uuid } from '#lib/server/http.ts';
import { changed } from '#lib/server/events.ts';

const schema=z.object({categoryId: z.string().min(1).max(40)}).strict();

export const PATCH: RequestHandler = async(event)=>{
  const productId=uuid.safeParse(event.params.id);
  if(!productId.success) return response({error:'Invalid product'},400);
  const {categoryId}=await parsed(event,schema);
  const db=database();
  if(!db.prepare('SELECT 1 FROM categories WHERE id=?').get(categoryId))
    return response({error:'Unknown category'},400);
  const result=db.prepare('UPDATE products SET category_id=?,updated_at=? WHERE id=? AND active=1')
    .run(categoryId,now(),productId.data);
  if (!result.changes) return response({error:'Product not found'},404);
  changed('catalog');
  return response({ok:true});
};
