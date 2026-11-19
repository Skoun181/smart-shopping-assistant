import {describe,expect,test} from 'vitest';
import Database from 'better-sqlite3';
import {readFileSync} from 'node:fs';
import {updateShoppingItem} from '../src/lib/server/shopping-transfer';
function fixture(){
  const db=new Database(':memory:');db.pragma('foreign_keys=ON');
  db.exec(readFileSync('scripts/migrations/0001_initial.sql','utf8'));
  db.exec(`INSERT INTO categories(id,name_de,name_en) VALUES('meat','Fleisch','Meat');
    INSERT INTO units VALUES('pack','Packung','Pack','count',1),('pcs','Stück','Piece','count',1);
    INSERT INTO products(id,category_id,name_de,source,created_at,updated_at) VALUES('salami','meat','Salami','catalog',1,1);
    INSERT INTO product_variants(id,product_id,label_de) VALUES('spicy','salami','Scharf');
    INSERT INTO pantry_locations VALUES('home','Zuhause','Home'),('other','Keller','Cellar');
    INSERT INTO shopping_lists VALUES('default','Default',0,1);
    INSERT INTO shopping_items(id,list_id,product_id,name_snapshot,quantity,unit_id,created_at,updated_at) VALUES('buy','default','salami','Salami',1,'pack',1,1);
    INSERT INTO pantry_items(id,location_id,product_id,name_snapshot,quantity,unit_id,created_at,updated_at) VALUES('stock','home','salami','Salami',1,'pack',1,1);`);
  db.exec(readFileSync('scripts/migrations/0004_shopping_pantry_transfers.sql','utf8'));
  const stock=()=>db.prepare('SELECT id,quantity,version FROM pantry_items ORDER BY id').all();
  const item=()=>db.prepare("SELECT checked,quantity,version FROM shopping_items WHERE id='buy'").get();
  const patch=(v:Parameters<typeof updateShoppingItem>[2])=>updateShoppingItem(db,'buy',v,2);
  return {db,stock,item,patch};
}
describe('shopping to pantry',()=>{
  test('one pack plus one pack, stale and repeated check cannot add twice; reopen and purchase more',()=>{
    const {db,stock,item,patch}=fixture();
    try{
      expect(patch({checked:true,expectedVersion:1})).toEqual({ok:true,pantryChanged:true});
      expect(stock()).toEqual([{id:'stock',quantity:2,version:2}]);
      expect(patch({checked:true,expectedVersion:1})).toMatchObject({ok:false,status:409});
      expect(patch({checked:true,expectedVersion:2})).toEqual({ok:true,pantryChanged:false});
      expect(stock()).toEqual([{id:'stock',quantity:2,version:2}]);
      expect(patch({quantity:3,expectedVersion:3})).toMatchObject({ok:false,status:409});
      expect(patch({checked:false,expectedVersion:3})).toEqual({ok:true,pantryChanged:false});
      expect(stock()).toEqual([{id:'stock',quantity:2,version:2}]);
      expect(patch({checked:true,quantity:2,expectedVersion:4})).toEqual({ok:true,pantryChanged:true});
      expect(stock()).toEqual([{id:'stock',quantity:4,version:3}]);
      expect(item()).toEqual({checked:1,quantity:2,version:5});
      db.prepare("DELETE FROM shopping_items WHERE id='buy'").run();
      expect(stock()).toEqual([{id:'stock',quantity:4,version:3}]);
    }finally{db.close();}
  });
  test('different variant, unit and location do not merge; missing stock creates new row; reopening leaves it untouched',()=>{
    const {db,stock,patch}=fixture();
    try{
      db.exec("UPDATE pantry_items SET variant_id='spicy' WHERE id='stock'; INSERT INTO pantry_items(id,location_id,product_id,name_snapshot,quantity,unit_id,created_at,updated_at) VALUES('pieces','home','salami','Salami',1,'pcs',1,1),('cellar','other','salami','Salami',1,'pack',1,1)");
      expect(patch({checked:true,expectedVersion:1})).toMatchObject({ok:true});
      expect(stock()).toHaveLength(4);
      const purchased=stock();
      expect(patch({checked:false,expectedVersion:2})).toEqual({ok:true,pantryChanged:false});
      expect(stock()).toEqual(purchased);
    }finally{db.close();}
  });
  test('consumed stock does not block reopening; overflow leaves both unchanged',()=>{
    const {db,stock,item,patch}=fixture();
    try{
      db.exec("UPDATE pantry_items SET quantity=1000000 WHERE id='stock'");
      expect(patch({checked:true,expectedVersion:1})).toMatchObject({ok:false,status:409});
      expect(item()).toEqual({checked:0,quantity:1,version:1});
      expect(stock()).toEqual([{id:'stock',quantity:1000000,version:1}]);
      db.exec("UPDATE pantry_items SET quantity=1 WHERE id='stock'");
      expect(patch({checked:true,expectedVersion:1})).toMatchObject({ok:true});
      db.exec("DELETE FROM pantry_items WHERE id='stock'");
      expect(patch({checked:false,expectedVersion:2})).toEqual({ok:true,pantryChanged:false});
      expect(item()).toEqual({checked:0,quantity:1,version:3});
      expect(stock()).toEqual([]);
      expect(patch({checked:true,expectedVersion:3})).toEqual({ok:true,pantryChanged:true});
      expect(stock()).toHaveLength(1);
      expect(stock()[0]).toMatchObject({quantity:1,version:1});
    }finally{db.close();}
  });
  test('previously checked rows are not retroactively imported or subtracted',()=>{
    const {db,stock,patch}=fixture();
    try{
      db.exec("UPDATE shopping_items SET checked=1 WHERE id='buy'");
      expect(patch({checked:false,expectedVersion:1})).toEqual({ok:true,pantryChanged:false});
      expect(stock()).toEqual([{id:'stock',quantity:1,version:1}]);
    }finally{db.close();}
  });
});
