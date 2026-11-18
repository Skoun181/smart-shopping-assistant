import type { RequestHandler } from './$types';
import { z } from 'zod';
import { database, now } from '#lib/server/db.ts';
import { parsed, quantity, response, uuid } from '#lib/server/http.ts';
import { changed } from '#lib/server/events.ts';
const patchSchema=z.object({quantity,expectedVersion:z.number().int().positive()}).strict();
export const PATCH: RequestHandler = async (event) => {
  const id=uuid.safeParse(event.params.id);
  if (!id.success) return response({error:'Invalid ID'},400);
  const data=await parsed(event,patchSchema);
  const result=database().prepare('UPDATE pantry_items SET quantity=?,version=version+1,updated_at=? WHERE id=? AND version=?')
    .run(data.quantity,now(),id.data,data.expectedVersion);
  if (!result.changes) return response({error:'Item missing or changed on another device'},409);
  changed('pantry');
  return response({ok:true});
};
export const DELETE: RequestHandler = (event) => {
  const id=uuid.safeParse(event.params.id);
  if (!id.success) return response({error:'Invalid ID'},400);
  const result=database().prepare('DELETE FROM pantry_items WHERE id=?').run(id.data);
  if (!result.changes) return response({error:'Not found'},404);
  changed('pantry');
  return response({ok:true});
};
