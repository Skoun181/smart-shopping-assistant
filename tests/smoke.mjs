// @ts-nocheck — container smoke harness, validated at runtime by Node assertions
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const expectedVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const BASE='http://127.0.0.1:3333';
const setupToken=process.env.APP_SETUP_TOKEN||'shopping-ci-setup-token';
const password='ci-testing-password-very-long';
async function raw(path,options={}) {return fetch(BASE+'/api/v1'+path,options);}
function jsonOptions(method,data,cookie,origin=BASE){
  return {method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)};
}
let res=await raw('/health');
assert.equal(res.status,200,'health');
res=await raw('/catalog');
assert.equal(res.status,401,'catalog should require login');
// No environment password: first startup is a one-time shared-password setup.
res=await fetch(BASE+'/login');assert.match(await res.text(),/Create Login/);
res=await raw('/auth/login',jsonOptions('POST',{password}));
assert.equal(res.status,409,'login before setup rejected');
res=await raw('/auth/setup',jsonOptions('POST',{password,confirmation:password,setupToken},undefined,'http://evil.example'));
assert.equal(res.status,403,'cross-origin setup rejected');
res=await raw('/auth/setup',jsonOptions('POST',{password:'short',confirmation:'short'}));
assert.equal(res.status,400,'short setup password rejected');
res=await raw('/auth/setup',jsonOptions('POST',{password,confirmation:'wrong'}));
assert.equal(res.status,400,'confirmation required');
res=await raw('/auth/setup',jsonOptions('POST',{password,confirmation:password}));
assert.equal(res.status,403,'initial setup requires local token');
const setupResults=await Promise.all([raw('/auth/setup',jsonOptions('POST',{password,confirmation:password,setupToken})),raw('/auth/setup',jsonOptions('POST',{password,confirmation:password,setupToken}))]);
assert.deepEqual(setupResults.map(r=>r.status).sort(),[201,409],'setup exactly once even for concurrent requests');
res=await raw('/auth/setup',jsonOptions('POST',{password:'attacker-password-123',confirmation:'attacker-password-123'}));
assert.equal(res.status,409,'setup cannot overwrite existing password');
res=await raw('/auth/login',jsonOptions('POST',{password},undefined,'http://evil.example'));
assert.equal(res.status,403,'cross-origin login must be blocked');
res=await raw('/auth/login',jsonOptions('POST',{password:'wrong-password'}));
assert.equal(res.status,401,'wrong password');
res=await raw('/auth/login',jsonOptions('POST',{password}));
assert.equal(res.status,200,'correct login');
const cookie=(res.headers.get('set-cookie')||'').split(';')[0];
assert.ok(cookie.startsWith('shopping_session='),'session cookie');
const opts={headers:{Cookie:cookie}};
res=await raw('/catalog',opts);
assert.equal(res.status,200,'authenticated catalog');
const catalog=await res.json();
assert.ok(catalog.products.length>=100,'seed catalog');
const milk=catalog.products.find((p)=>p.name_de==='Milch');
assert.ok(milk,'milk in seeded products');
assert.ok(catalog.variants.some((v)=>v.product_id===milk.id),'milk variants');
res=await raw('/catalog',jsonOptions('POST',{nameDe:'CI Testprodukt',categoryId:'produce'},cookie));
assert.equal(res.status,201,'custom product create');
const custom=await res.json();
res=await raw('/shopping',jsonOptions('POST',{productId:custom.id,quantity:2,unitId:'pcs',note:''},cookie));
assert.equal(res.status,201,'shopping create');
const created=await res.json();
res=await raw('/shopping',jsonOptions('POST',{productId:custom.id,quantity:1,unitId:'pcs',note:''},cookie));
assert.equal(res.status,201,'shopping duplicate');
assert.equal((await res.json()).merged,true,'duplicate merged');
res=await raw('/shopping',opts);
assert.equal(res.status,200);
let item=(await res.json()).items.find((i)=>i.id===created.id);
assert.equal(item.quantity,3,'merged quantity');
res=await raw('/shopping/'+item.id,jsonOptions('PATCH',{checked:true,expectedVersion:item.version},cookie));
assert.equal(res.status,200,'mark purchased');
res=await raw('/shopping/'+item.id,jsonOptions('PATCH',{checked:true,expectedVersion:item.version},cookie));
assert.equal(res.status,409,'stale version blocked');
res=await raw('/pantry',opts);
assert.equal((await res.json()).items.filter(i=>i.product_id===custom.id).reduce((n,i)=>n+i.quantity,0),3,'checked purchase transferred only once');
res=await raw('/shopping/'+item.id,jsonOptions('PATCH',{checked:false,expectedVersion:item.version+1},cookie));
assert.equal(res.status,200,'reopen for another purchase');
res=await raw('/pantry',opts);
assert.equal((await res.json()).items.filter(i=>i.product_id===custom.id).reduce((n,i)=>n+i.quantity,0),3,'reopening preserves purchased stock');
res=await raw('/shopping/'+item.id,jsonOptions('PATCH',{checked:true,quantity:1,expectedVersion:item.version+2},cookie));
assert.equal(res.status,200,'buy another unit');
res=await raw('/pantry',opts);
assert.equal((await res.json()).items.filter(i=>i.product_id===custom.id).reduce((n,i)=>n+i.quantity,0),4,'second purchase adds to original stock');
res=await raw('/pantry',jsonOptions('POST',{productId:custom.id,quantity:1,unitId:'pcs',locationId:'home'},cookie));
assert.equal(res.status,201,'pantry create');
const pantryId=(await res.json()).id;
res=await raw('/pantry',opts);
assert.ok((await res.json()).items.some((i)=>i.id===pantryId),'pantry fetch');
res=await raw('/pantry',jsonOptions('POST',{productId:custom.id,quantity:-5,unitId:'pcs',locationId:'home'},cookie));
assert.equal(res.status,400,'invalid quantity blocked');
res=await raw('/pantry/'+pantryId,jsonOptions('DELETE',{expectedVersion:1},cookie));
assert.equal(res.status,200,'delete pantry item');
// Bulk selection should add many products in one atomic operation.
const selection = catalog.products.filter((p)=>p.name_de==='Milch'||p.name_de==='Äpfel');
assert.equal(selection.length,2,'gallery seeded product availability');
res=await raw('/shopping/bulk',jsonOptions('POST',{items:selection.map((p)=>({
  productId:p.id,quantity:1,unitId:p.name_de==='Milch'?'l':'pcs',note:''
}))},cookie));
assert.equal(res.status,201,'bulk add');
let stats=await res.json();
assert.equal(stats.added,2,'bulk adds both records');
res=await raw('/shopping/bulk',jsonOptions('POST',{items:selection.map((p)=>({
  productId:p.id,quantity:1,unitId:p.name_de==='Milch'?'l':'pcs',note:''
}))},cookie));
assert.equal(res.status,201,'bulk repeats');
stats=await res.json();
assert.equal(stats.merged,2,'bulk merges duplicates');
res=await raw('/shopping',opts);
let groupedItems=(await res.json()).items;
assert.equal(groupedItems.find((i)=>i.product_id===milk.id&&i.unit_id==='l').quantity,2,'merged milk has two litres');
const batch = {operationId:'d66d59cc-6495-4e4f-882d-6ef35f6dad7d',items:[
  {productId:milk.id,quantity:0.125,unitId:'l',note:'operation-id'}
]};
for(let attempt=0;attempt<2;attempt++){
  res=await raw('/shopping/bulk',jsonOptions('POST',batch,cookie));
  assert.equal(res.status,201);
}
res=await raw('/shopping',opts);
groupedItems=(await res.json()).items;
assert.equal(groupedItems.find(i=>i.note==='operation-id').quantity,0.125,'retry does not change quantity');
// If one product is invalid, NO valid product should have been written.
const before=groupedItems.length;
res=await raw('/shopping/bulk',jsonOptions('POST',{items:[
  {productId:selection[0].id,quantity:5,unitId:'pcs',note:'should-not-save'},
  {productId:'00000000-0000-4000-8000-000000000000',quantity:1,unitId:'pcs',note:''}
]},cookie));
assert.equal(res.status,400,'invalid bulk product blocked');
res=await raw('/shopping',opts);
assert.equal((await res.json()).items.length,before,'invalid batch not partially written');
// Category CRUD, product reassignment and free-text shopping additions.
res=await raw('/categories',opts);
assert.equal(res.status,200,'categories list');
assert.ok((await res.json()).categories.some((c)=>c.id==='hygiene'),'category seed');
res=await raw('/catalog',opts);
const expanded=await res.json();
assert.ok(expanded.products.some((p)=>p.name_de==='Binden'),'pads seeded in existing catalog');
assert.ok(expanded.products.some((p)=>p.name_de==='Tampons'),'tampons seeded');
assert.ok(expanded.products.some((p)=>p.name_de==='Zewa'),'paper towels seeded');
const cola=expanded.products.find((p)=>p.name_de==='Cola');
assert.ok(cola,'cola seeded');
res=await raw('/categories',jsonOptions('POST',{nameDe:'Baby & Familie',nameEn:'Baby & family'},cookie));
assert.equal(res.status,201,'custom category create');
const categoryId=(await res.json()).id;
res=await raw('/categories',jsonOptions('POST',{nameDe:'Baby & Familie'},cookie));
assert.equal(res.status,409,'duplicate category rejected');
res=await raw('/categories/'+categoryId,jsonOptions('PATCH',{nameDe:'Babybedarf',nameEn:'Baby supplies'},cookie));
assert.equal(res.status,200,'custom category rename');
res=await raw('/catalog/'+cola.id,jsonOptions('PATCH',{categoryId},cookie));
assert.equal(res.status,200,'catalog product move');
res=await raw('/catalog',opts);
const moved=(await res.json()).products.find((p)=>p.id===cola.id);
assert.equal(moved.category_id,categoryId,'new product category stored in DB');
res=await raw('/categories/'+categoryId,{method:'DELETE',headers:{Origin:BASE,Cookie:cookie}});
assert.equal(res.status,409,'occupied category cannot be removed');
res=await raw('/catalog/'+cola.id,jsonOptions('PATCH',{categoryId:'drinks'},cookie));
assert.equal(res.status,200,'move product back');
res=await raw('/categories/'+categoryId,{method:'DELETE',headers:{Origin:BASE,Cookie:cookie}});
assert.equal(res.status,200,'empty user category removed');
res=await raw('/categories/hygiene',{method:'DELETE',headers:{Origin:BASE,Cookie:cookie}});
assert.equal(res.status,400,'cannot delete system category with invalid id');
res=await raw('/shopping/custom',jsonOptions('POST',{
  nameDe:'Binden',categoryId:'hygiene',quantity:1,unitId:'pack',note:''
},cookie));
assert.equal(res.status,201,'free text reuses matching catalog product');
let free=await res.json();
assert.equal(free.createdProduct,false,'no duplicate pads created');
res=await raw('/shopping/custom',jsonOptions('POST',{
  nameDe:'Pferde-Leckerli',categoryId:'snacks',quantity:2,unitId:'pack',note:''
},cookie));
assert.equal(res.status,201,'free text product creates product and shopping item');
free=await res.json();
assert.equal(free.createdProduct,true,'custom catalog entry created');
res=await raw('/shopping',opts);
assert.ok((await res.json()).items.some((i)=>i.product_id===free.productId),'free text linked to shopping');
res=await raw('/shopping/custom',jsonOptions('POST',{
  nameDe:'Should Not Exist',categoryId:'unknown',quantity:1,unitId:'pcs',note:''
},cookie));
assert.equal(res.status,400,'unknown category rejected before writes');
res=await raw('/catalog',opts);
assert.ok(!(await res.json()).products.some((p)=>p.name_de==='Should Not Exist'),'invalid free text did not create a product');
res=await raw('/pantry/custom',jsonOptions('POST',{
  nameDe:'Katzenstreu',categoryId:'cleaning',quantity:1,unitId:'pack',locationId:'home'
},cookie));
assert.equal(res.status,201,'pantry free text');
const pantryCustom=await res.json();
assert.equal(pantryCustom.createdProduct,true,'custom pantry catalog entry');
res=await raw('/pantry',opts);
assert.ok((await res.json()).items.some((i)=>i.product_id===pantryCustom.productId),'custom pantry entry persisted');
// Version-checked stock adjustment, including consuming the final unit.
res=await raw('/pantry',opts);
const stock=(await res.json()).items.find(i=>i.product_id===pantryCustom.productId);
assert.ok(stock,'stock entry exists');
res=await raw('/pantry/'+stock.id,jsonOptions('PATCH',{quantity:2,expectedVersion:stock.version},cookie));
assert.equal(res.status,200,'increase pantry quantity');
res=await raw('/pantry/'+stock.id,jsonOptions('PATCH',{quantity:0,expectedVersion:stock.version},cookie));
assert.equal(res.status,409,'stale device cannot remove stock');
res=await raw('/pantry/'+stock.id,jsonOptions('PATCH',{quantity:-1,expectedVersion:stock.version+1},cookie));
assert.equal(res.status,400,'negative stock rejected');
res=await raw('/pantry/'+stock.id,jsonOptions('PATCH',{quantity:1,expectedVersion:stock.version+1},cookie));
assert.equal(res.status,200,'consume one unit');
res=await raw('/pantry/'+stock.id,jsonOptions('PATCH',{quantity:0,expectedVersion:stock.version+2},cookie));
assert.equal(res.status,200,'consume last unit');
res=await raw('/pantry',opts);assert.ok(!(await res.json()).items.some(i=>i.id===stock.id),'empty stock entry removed');
res=await raw('/catalog',opts);assert.ok((await res.json()).products.some(p=>p.id===pantryCustom.productId),'catalog product preserved');
// Release gate: verify import confirmation and idempotence with synthetic data.
res=await raw('/health');assert.equal((await res.json()).version,expectedVersion,'application version');
res=await raw('/pantry/scan',{method:'POST',headers:{Origin:BASE,'Content-Type':'text/plain','X-Scan-Mode':'receipt',Cookie:cookie},body:'MILCH 1,29 A\nSUMME 1,29'});
assert.equal(res.status,200,'local receipt scan');
assert.equal((await res.json()).items.length,1,'receipt product suggestion');
const stableImport={importId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',confirmed:true,items:[{name:'Milch',quantity:2,unit:'l',categoryId:'dairy',variant:'',productId:milk.id},{name:'CI Import Release',quantity:1,unit:'pcs',categoryId:'produce',variant:'',productId:null}]};
res=await raw('/pantry',opts);const releaseBefore=(await res.json()).items.length;
res=await raw('/pantry/import',jsonOptions('POST',{...stableImport,confirmed:false},cookie));assert.equal(res.status,400,'confirmation required');
res=await raw('/pantry/import',jsonOptions('POST',{...stableImport,items:[...stableImport.items,{name:'bad',quantity:1,unit:'pcs',categoryId:'missing',variant:'',productId:null}]},cookie));assert.equal(res.status,409,'invalid batch rejected');
res=await raw('/pantry',opts);assert.equal((await res.json()).items.length,releaseBefore,'failed batch writes nothing');
res=await raw('/pantry/import',jsonOptions('POST',stableImport,cookie));assert.equal(res.status,201,'approved import');
res=await raw('/pantry/import',jsonOptions('POST',stableImport,cookie));assert.equal(res.status,200,'idempotent retry');assert.equal((await res.json()).repeated,true);
res=await raw('/pantry',opts);assert.equal((await res.json()).items.length,releaseBefore+2,'no duplicated stock on retry');
// Portable backup: authenticated ZIP export, preview, corruption rejection and restore.
res=await raw('/backup',{headers:{Cookie:cookie}});
assert.equal(res.status,200,'download portable backup');
assert.match(res.headers.get('content-type')||'',/application\/zip/);
const exported=Buffer.from(await res.arrayBuffer());
assert.ok(exported.subarray(0,2).equals(Buffer.from('PK')),'valid ZIP signature');
assert.ok(!exported.includes(Buffer.from('auth.password_hash'))&&!exported.includes(Buffer.from('scrypt$32768')),'backup excludes credentials');
res=await raw('/backup/preview',{method:'POST',headers:{Origin:BASE,'Content-Type':'application/zip',Cookie:cookie},body:exported});
assert.equal(res.status,200,'preview valid backup');
const backupPreview=await res.json();
assert.ok(backupPreview.totalRecords>0,'backup has data');
res=await raw('/backup/preview',{method:'POST',headers:{Origin:'http://malicious.invalid','Content-Type':'application/zip',Cookie:cookie},body:exported});
assert.equal(res.status,403,'backup preview protected by origin');
const brokenZip=Buffer.from(exported);brokenZip[45]^=7;
res=await raw('/backup/preview',{method:'POST',headers:{Origin:BASE,'Content-Type':'application/zip',Cookie:cookie},body:brokenZip});
assert.equal(res.status,422,'invalid ZIP is rejected');
res=await raw('/backup/restore',{method:'POST',headers:{Origin:BASE,'Content-Type':'application/zip',Cookie:cookie},body:exported});
assert.equal(res.status,200,'restore accepted');
const restored=await res.json();
assert.equal(restored.importedRecords,backupPreview.totalRecords);
assert.match(restored.safetyBackup,/^pre-import-.*\.zip$/);
res=await raw('/pantry',opts);assert.ok((await res.json()).items.length>=releaseBefore+2,'pantry restored and available');
res=await raw('/auth/logout',{method:'POST',headers:{Origin:BASE,Cookie:cookie}});
assert.equal(res.status,200,'logout');
res=await raw('/shopping',opts);
assert.equal(res.status,401,'logout revoked session');
console.log('SMOKE_TEST_OK first-run setup, login, CSRF, catalog expansion, pantry and shopping, portable ZIP backup and restore');
