import type { RequestHandler } from './$types';
import { database, now } from '$lib/server/db';
import { changeBody, parsed, response, uuid } from '$lib/server/http';
import { changed } from '$lib/server/events';
import { z } from 'zod';

export const PATCH: RequestHandler = async (event) => {
  const id=uuid.safeParse(event.params.id);
  if (!id.success) return response({error:'Invalid ID'},400);
  const value=await parsed(event,changeBody);
  const keys: string[]=[];const args: unknown[]=[];
  if (value.quantity !== undefined) {keys.push('quantity=?');args.push(value.quantity);}
  if (value.note !== undefined) {keys.push('note=?');args.push(value.note);}
  if (value.checked !== undefined) {keys.push('checked=?','checked_at=?');args.push(value.checked?1:0,value.checked?now():null);}
  if (!keys.length) return response({error:'Nothing to update'},400);
  const db=database();
  const t=now();
  const sql='UPDATE shopping_items SET '+keys.join(',')+',version=version+1,updated_at=? WHERE id=? AND version=?';
  const result=db.prepare(sql).run(...args,t,id.data,value.expectedVersion);
  if (!result.changes) return response({error:'Item missing or changed on another device'},409);
  changed('shopping');
  return response({ok:true});
};
export const DELETE: RequestHandler = (event) => {
  const id=uuid.safeParse(event.params.id);
  if (!id.success) return response({error:'Invalid ID'},400);
  const result=database().prepare('DELETE FROM shopping_items WHERE id=?').run(id.data);
  if (!result.changes) return response({error:'Not found'},404);
  changed('shopping');
  return response({ok:true});
};
