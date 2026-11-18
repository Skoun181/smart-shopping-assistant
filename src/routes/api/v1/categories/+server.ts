import type { RequestHandler } from './$types';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database } from '#lib/server/db.ts';
import { parsed, response } from '#lib/server/http.ts';
import { changed } from '#lib/server/events.ts';

export const categoryName = z.string().trim().min(1).max(70);
export const categoryBody = z.object({
  nameDe: categoryName,
  nameEn: categoryName.optional()
}).strict();

export const GET: RequestHandler = () => {
  return response({categories: database().prepare(
    'SELECT id,name_de,name_en,sort_order,is_custom FROM categories ORDER BY sort_order, name_de'
  ).all()});
};
export const POST: RequestHandler = async (event) => {
  const input=await parsed(event,categoryBody);
  const db=database();
  const nameEn=input.nameEn||input.nameDe;
  const existing=db.prepare('SELECT 1 FROM categories WHERE name_de = ? COLLATE NOCASE OR name_en = ? COLLATE NOCASE LIMIT 1')
    .get(input.nameDe,nameEn);
  if (existing) return response({error:'Category already exists'},409);
  const id=randomUUID();
  const position=db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM categories').get() as {next:number};
  db.prepare('INSERT INTO categories(id,name_de,name_en,sort_order,is_custom) VALUES(?,?,?,?,1)')
    .run(id,input.nameDe,nameEn,position.next);
  changed('catalog');
  return response({id},201);
};
