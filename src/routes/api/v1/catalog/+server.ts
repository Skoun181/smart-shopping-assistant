import type { RequestHandler } from './$types';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { database, now } from '$lib/server/db';
import { name, parsed, response, uuid } from '$lib/server/http';
import { changed } from '$lib/server/events';

export const GET: RequestHandler = () => {
  const db=database();
  return response({
    categories: db.prepare('SELECT * FROM categories ORDER BY sort_order').all(),
    units: db.prepare('SELECT * FROM units').all(),
    products: db.prepare('SELECT id,category_id,name_de,name_en,brand,source FROM products WHERE active=1 ORDER BY name_de COLLATE NOCASE').all(),
    variants: db.prepare('SELECT id,product_id,label_de,label_en FROM product_variants').all()
  });
};
const schema = z.object({
  nameDe: name,
  nameEn: name.optional(),
  categoryId: z.string().min(1).max(40),
  brand: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  variantDe: z.string().trim().min(1).max(80).optional(),
  variantEn: z.string().trim().min(1).max(80).optional()
}).strict();
export const POST: RequestHandler = async (event) => {
  const input = await parsed(event,schema);
  const db=database();
  if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(input.categoryId)) return response({error:'Unknown category'},400);
  const id=randomUUID(), t=now();
  db.transaction(()=>{
    db.prepare('INSERT INTO products(id,category_id,name_de,name_en,brand,description,source,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)')
      .run(id,input.categoryId,input.nameDe,input.nameEn??null,input.brand??null,input.description??null,'custom',t,t);
    if (input.variantDe) db.prepare('INSERT INTO product_variants(id,product_id,label_de,label_en,attributes) VALUES(?,?,?,?,?)')
      .run(randomUUID(),id,input.variantDe,input.variantEn??null,'{}');
  })();
  changed('catalog');
  return response({id},201);
};
