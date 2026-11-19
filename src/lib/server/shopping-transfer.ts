import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

type Update={quantity?:number;checked?:boolean;note?:string;expectedVersion:number};
type ShoppingRow={id:string;product_id:string|null;variant_id:string|null;name_snapshot:string;quantity:number;unit_id:string;checked:number;version:number;note:string;checked_at:number|null};
type StockRow={id:string;quantity:number;version:number};
type Transfer={pantry_item_id:string;quantity:number};
type Result={ok:true;pantryChanged:boolean}|{ok:false;error:string;status:400|409};

export function updateShoppingItem(db:Database.Database,id:string,value:Update,t:number):Result{
  return db.transaction(():Result=>{
    const item=db.prepare('SELECT * FROM shopping_items WHERE id=?').get(id) as ShoppingRow|undefined;
    if(!item||item.version!==value.expectedVersion)return {ok:false,error:'Item missing or changed on another device',status:409};
    if(value.quantity===undefined&&value.checked===undefined&&value.note===undefined)return {ok:false,error:'Nothing to update',status:400};
    const checked=value.checked===undefined?!!item.checked:value.checked;
    const quantity=value.quantity??item.quantity;
    if(item.checked&&checked&&quantity!==item.quantity)return {ok:false,error:'Uncheck the purchased item before changing its quantity',status:409};
    let pantryChanged=false;
    if(!item.checked&&checked){
      // Merge only the exact product, variant, unit and home location. Never merge unrelated snapshots.
      const stock=item.product_id?db.prepare("SELECT id,quantity,version FROM pantry_items WHERE location_id='home' AND product_id=? AND variant_id IS ? AND unit_id=? ORDER BY created_at,id LIMIT 1").get(item.product_id,item.variant_id,item.unit_id) as StockRow|undefined:undefined;
      const combined=stock?stock.quantity+quantity:quantity;
      if(!Number.isFinite(combined)||combined>1000000||(stock&&combined<=stock.quantity))return {ok:false,error:'Pantry quantity would exceed its allowed range',status:409};
      const pantryId=stock?.id??randomUUID();
      if(stock)db.prepare('UPDATE pantry_items SET quantity=?,version=version+1,updated_at=? WHERE id=?').run(combined,t,pantryId);
      else db.prepare('INSERT INTO pantry_items(id,location_id,product_id,variant_id,name_snapshot,quantity,unit_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(pantryId,'home',item.product_id,item.variant_id,item.name_snapshot,quantity,item.unit_id,t,t);
      db.prepare('INSERT INTO shopping_pantry_transfers(shopping_item_id,pantry_item_id,quantity) VALUES(?,?,?)').run(item.id,pantryId,quantity);
      pantryChanged=true;
    }else if(item.checked&&!checked){
      const transfer=db.prepare('SELECT pantry_item_id,quantity FROM shopping_pantry_transfers WHERE shopping_item_id=?').get(item.id) as Transfer|undefined;
      // Legacy checked rows have no recorded transfer; do not subtract historical stock.
      if(transfer){
        const stock=db.prepare("SELECT id,quantity,version FROM pantry_items WHERE id=? AND location_id='home' AND product_id IS ? AND variant_id IS ? AND unit_id=?").get(transfer.pantry_item_id,item.product_id,item.variant_id,item.unit_id) as StockRow|undefined;
        const tolerance=Number.EPSILON*Math.max(stock?.quantity??0,transfer.quantity)*4;
        if(!stock||stock.quantity-transfer.quantity < -tolerance)return {ok:false,error:'Cannot undo purchase: transferred stock is no longer available',status:409};
        const remaining=stock.quantity-transfer.quantity;
        if(remaining<=tolerance)db.prepare('DELETE FROM pantry_items WHERE id=?').run(stock.id);
        else db.prepare('UPDATE pantry_items SET quantity=?,version=version+1,updated_at=? WHERE id=?').run(remaining,t,stock.id);
        db.prepare('DELETE FROM shopping_pantry_transfers WHERE shopping_item_id=?').run(item.id);
        pantryChanged=true;
      }
    }
    const checkedAt=checked?(item.checked?item.checked_at:t):null;
    db.prepare('UPDATE shopping_items SET quantity=?,note=?,checked=?,checked_at=?,version=version+1,updated_at=? WHERE id=?').run(quantity,value.note??item.note,checked?1:0,checkedAt,t,id);
    return {ok:true,pantryChanged};
  }).immediate();
}
