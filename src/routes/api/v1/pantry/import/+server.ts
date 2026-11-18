import type { RequestHandler } from './$types';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { database, now } from '#lib/server/db.ts';
import { name, quantity, parsed, response, uuid } from '#lib/server/http.ts';
import { changed } from '#lib/server/events.ts';
import { normalized, units } from '#lib/pantry-import.ts';

const schema=z.object({
  importId:uuid,
  confirmed:z.literal(true),
  items:z.array(z.object({
    name, quantity, unit:z.enum(units), categoryId:z.string().min(1).max(40),
    variant:z.string().trim().max(80), productId:uuid.nullable()
  }).strict()).min(1).max(200)
}).strict();

export const POST:RequestHandler=async(event)=>{
  const input=await parsed(event,schema,128000);
  const db=database(), t=now();
  const digest=createHash('sha256').update(JSON.stringify(input.items)).digest('hex');
  const previous=db.prepare('SELECT digest,item_count FROM pantry_imports WHERE id=?').get(input.importId) as {digest:string;item_count:number}|undefined;
  if(previous)return previous.digest===digest?response({count:previous.item_count,repeated:true}):response({error:'Import ID already used'},409);
  const getCategory=db.prepare('SELECT 1 FROM categories WHERE id=?');
  const getProduct=db.prepare('SELECT id,name_de,category_id FROM products WHERE active=1 AND id=?');
  const insertProduct=db.prepare("INSERT INTO products(id,category_id,name_de,source,active,created_at,updated_at) VALUES(?,?,?,'custom',1,?,?)");
  const insertVariant=db.prepare("INSERT INTO product_variants(id,product_id,label_de,attributes) VALUES(?,?,?,'{}')");
  const insertPantry=db.prepare('INSERT INTO pantry_items(id,location_id,product_id,variant_id,name_snapshot,quantity,unit_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
  try{
    db.transaction(()=>{
      for(const item of input.items){
        if(!getCategory.get(item.categoryId))throw Error('Unknown category');
        let product: {id:string;name_de:string;category_id:string}|undefined;
        if(item.productId){
          product=getProduct.get(item.productId) as typeof product;
          if(!product||product.category_id!==item.categoryId)throw Error('Product category changed; review again');
          if(normalized(product.name_de)!==normalized(item.name))throw Error('Product name changed; review again');
        }else{
          const candidates=db.prepare('SELECT id,name_de,category_id FROM products WHERE active=1 AND category_id=?').all(item.categoryId) as Array<{id:string;name_de:string;category_id:string}>;
          product=candidates.find(p=>normalized(p.name_de)===normalized(item.name));
          if(!product){product={id:randomUUID(),name_de:item.name,category_id:item.categoryId};insertProduct.run(product.id,item.categoryId,item.name,t,t);}
        }
        let variantId:string|null=null;
        if(item.variant){
          const variants=db.prepare('SELECT id,label_de FROM product_variants WHERE product_id=?').all(product.id) as Array<{id:string;label_de:string}>;
          const existing=variants.find(v=>normalized(v.label_de)===normalized(item.variant));
          variantId=existing?.id??randomUUID();
          if(!existing)insertVariant.run(variantId,product.id,item.variant);
        }
        // Every accepted row is an additional stock entry, never a replacement.
        insertPantry.run(randomUUID(),'home',product.id,variantId,product.name_de,item.quantity,item.unit,t,t);
      }
      db.prepare('INSERT INTO pantry_imports(id,digest,item_count,created_at) VALUES(?,?,?,?)').run(input.importId,digest,input.items.length,t);
    })();
  }catch(e){if(e instanceof Error&&['Unknown category','Product category changed; review again','Product name changed; review again'].includes(e.message))return response({error:e.message},409);throw e;}
  changed('catalog');changed('pantry');
  return response({count:input.items.length,repeated:false},201);
};
