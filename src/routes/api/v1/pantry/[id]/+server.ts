import type { RequestHandler } from './$types';
import { z } from 'zod';
import { database, now } from '#lib/server/db.ts';
import { deleteBody, parsed, response, uuid } from '#lib/server/http.ts';
import { changed } from '#lib/server/events.ts';
const patchSchema=z.object({quantity:z.number().finite().min(0).max(1000000),expectedVersion:z.number().int().positive()}).strict();
export const PATCH: RequestHandler = async (event) => {
  const id=uuid.safeParse(event.params.id);
  if (!id.success) return response({error:'Invalid ID'},400);
  const data=await parsed(event,patchSchema);
  // Consuming the last unit removes the stock entry, never the catalog product.
  // The version check also applies to removal, so stale devices cannot delete fresh stock.
  const db=database();
  const result=data.quantity===0
    ? db.prepare('DELETE FROM pantry_items WHERE id=? AND version=?').run(id.data,data.expectedVersion)
    : db.prepare('UPDATE pantry_items SET quantity=?,version=version+1,updated_at=? WHERE id=? AND version=?')
        .run(data.quantity,now(),id.data,data.expectedVersion);
  if (!result.changes) return response({error:'Item missing or changed on another device'},409);
  changed('pantry');
  return response({ok:true});
};
export const DELETE: RequestHandler = async (event) => {
  const id=uuid.safeParse(event.params.id);
  if (!id.success) return response({error:'Invalid ID'},400);
  const version = await parsed(event,deleteBody);
  const result=database().prepare('DELETE FROM pantry_items WHERE id=? AND version=?').run(id.data,version.expectedVersion);
  if (!result.changes) return response({error:'Item missing or changed on another device'},409);
  changed('pantry');
  return response({ok:true});
};
