import type { RequestHandler } from './$types';
import { database } from '#lib/server/db.ts';
import { parsed, response, uuid } from '#lib/server/http.ts';
import { categoryBody } from '../+server';
import { changed } from '#lib/server/events.ts';

export const PATCH: RequestHandler = async (event) => {
  const result=uuid.safeParse(event.params.id);
  if (!result.success) return response({error:'Invalid category'},400);
  const input=await parsed(event,categoryBody);
  const db=database();
  const current=db.prepare('SELECT is_custom FROM categories WHERE id=?').get(result.data) as {is_custom:number}|undefined;
  if (!current) return response({error:'Category not found'},404);
  if (!current.is_custom) return response({error:'Default categories cannot be renamed'},403);
  const nameEn=input.nameEn||input.nameDe;
  if (db.prepare('SELECT 1 FROM categories WHERE id!=? AND (name_de=? COLLATE NOCASE OR name_en=? COLLATE NOCASE) LIMIT 1')
    .get(result.data,input.nameDe,nameEn)) return response({error:'Category already exists'},409);
  db.prepare('UPDATE categories SET name_de=?,name_en=? WHERE id=?').run(input.nameDe,nameEn,result.data);
  changed('catalog');
  return response({ok:true});
};
export const DELETE: RequestHandler = (event) => {
  const result=uuid.safeParse(event.params.id);
  if (!result.success) return response({error:'Invalid category'},400);
  const db=database();
  const existing=db.prepare('SELECT is_custom FROM categories WHERE id=?').get(result.data) as {is_custom:number}|undefined;
  if(!existing) return response({error:'Category not found'},404);
  if(!existing.is_custom) return response({error:'Default categories cannot be deleted'},403);
  if(db.prepare('SELECT 1 FROM products WHERE category_id=? LIMIT 1').get(result.data))
    return response({error:'Move all products out of this category before deleting it'},409);
  db.prepare('DELETE FROM categories WHERE id=? AND is_custom=1').run(result.data);
  changed('catalog');
  return response({ok:true});
};
