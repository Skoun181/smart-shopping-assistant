import { describe, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { seedCatalog } from '../src/lib/server/seed';
import { expandedCatalog } from '../src/lib/server/expanded-catalog';
import { productEmoji } from '../src/lib/ui/product-emoji';

function sampleDb() {
  const db=new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync('scripts/migrations/0001_initial.sql','utf8'));
  return db;
}

describe('existing households upgrade safely',()=>{
  test('legacy database receives expanded curated catalog without duplicating or recategorizing',()=>{
    const db=sampleDb();
    seedCatalog(db); // legacy installation had already been seeded
    db.exec(readFileSync('scripts/migrations/0002_custom_categories.sql','utf8'));
    db.prepare('UPDATE products SET category_id=? WHERE name_de=?').run('snacks','Cola');
    const oldMilk=db.prepare('SELECT id FROM products WHERE name_de=?').get('Milch') as {id:string};
    const customId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    db.prepare("INSERT INTO categories(id,name_de,name_en,sort_order,is_custom) VALUES(?,?,?,?,1)")
      .run(customId,'Mein Sonderregal','My special shelf',100);
    db.prepare("UPDATE products SET category_id=? WHERE name_de=?").run(customId,'Binden');
    const countBefore=(db.prepare('SELECT COUNT(*) AS count FROM products').get() as {count:number}).count;
    seedCatalog(db);
    const countAfter=(db.prepare('SELECT COUNT(*) AS count FROM products').get() as {count:number}).count;
    const cola=db.prepare('SELECT category_id FROM products WHERE name_de=?').get('Cola') as {category_id:string};
    const pads=db.prepare('SELECT category_id FROM products WHERE name_de=?').get('Binden') as {category_id:string};
    const milk=db.prepare('SELECT id FROM products WHERE name_de=?').get('Milch') as {id:string};
    expect(countAfter).toBe(countBefore);
    expect(cola.category_id).toBe('snacks');
    expect(pads.category_id).toBe(customId);
    expect(milk.id).toBe(oldMilk.id);
    expect((db.prepare('SELECT COUNT(*) AS count FROM products WHERE name_de=?').get('Zewa') as {count:number}).count).toBe(1);
    db.close();
  });
  test('important everyday items have translations and emoji fallbacks',()=>{
    for(const name of ['Binden','Tampons','Slipeinlagen','Zewa','Küchenpapier','Toilettenpapier 3-lagig','Windeln']){
      const match=expandedCatalog.find(([,de])=>de===name);
      expect(match).toBeTruthy();
      expect(match![2].length).toBeGreaterThan(0);
      expect(productEmoji(name,match![0]).length).toBeGreaterThan(0);
    }
  });
  test('migration marks original categories as built-in and permits custom ones',()=>{
    const db=sampleDb();
    db.exec(readFileSync('scripts/migrations/0002_custom_categories.sql','utf8'));
    seedCatalog(db);
    const builtIn=db.prepare('SELECT is_custom FROM categories WHERE id=?').get('hygiene') as {is_custom:number};
    expect(builtIn.is_custom).toBe(0);
    db.prepare("INSERT INTO categories(id,name_de,name_en,sort_order,is_custom) VALUES(?,?,?,?,1)")
      .run('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Haustiere','Pets',100);
    expect((db.prepare('SELECT COUNT(*) AS count FROM categories').get() as {count:number}).count).toBeGreaterThan(11);
    db.close();
  });
});
