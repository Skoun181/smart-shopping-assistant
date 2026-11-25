import type { RequestHandler } from './$types';
import { database, now } from '#lib/server/db.ts';
import { changeBody, deleteBody, parsed, response, uuid } from '#lib/server/http.ts';
import { changed } from '#lib/server/events.ts';
import { updateShoppingItem } from '#lib/server/shopping-transfer.ts';

export const PATCH: RequestHandler = async (event) => {
  const id=uuid.safeParse(event.params.id);
  if (!id.success) return response({error:'Invalid ID'},400);
  const value=await parsed(event,changeBody);
  const result=updateShoppingItem(database(),id.data,value,now());
  if(!result.ok)return response({error:result.error},result.status);
  changed('shopping');
  if(result.pantryChanged)changed('pantry');
  return response({ok:true,pantryChanged:result.pantryChanged});
};
export const DELETE: RequestHandler = async (event) => {
  const id=uuid.safeParse(event.params.id);
  if (!id.success) return response({error:'Invalid ID'},400);
  const version = await parsed(event,deleteBody);
  const result=database().prepare('DELETE FROM shopping_items WHERE id=? AND version=?').run(id.data,version.expectedVersion);
  if (!result.changes) return response({error:'Item missing or changed on another device'},409);
  changed('shopping');
  return response({ok:true});
};
