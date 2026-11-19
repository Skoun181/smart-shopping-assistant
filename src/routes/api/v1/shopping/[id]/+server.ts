import type { RequestHandler } from './$types';
import { database, now } from '#lib/server/db.ts';
import { changeBody, parsed, response, uuid } from '#lib/server/http.ts';
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
export const DELETE: RequestHandler = (event) => {
  const id=uuid.safeParse(event.params.id);
  if (!id.success) return response({error:'Invalid ID'},400);
  const result=database().prepare('DELETE FROM shopping_items WHERE id=?').run(id.data);
  if (!result.changes) return response({error:'Not found'},404);
  changed('shopping');
  return response({ok:true});
};
