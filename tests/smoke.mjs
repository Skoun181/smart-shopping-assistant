// @ts-nocheck — container smoke harness, validated at runtime by Node assertions
import assert from 'node:assert/strict';
const BASE='http://127.0.0.1:3333';
const password='ci-testing-password-very-long';
async function raw(path,options={}) {return fetch(BASE+'/api/v1'+path,options);}
function jsonOptions(method,data,cookie,origin=BASE){
  return {method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)};
}
let res=await raw('/health');
assert.equal(res.status,200,'health');
res=await raw('/catalog');
assert.equal(res.status,401,'catalog should require login');
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
res=await raw('/pantry',jsonOptions('POST',{productId:custom.id,quantity:1,unitId:'pcs',locationId:'home'},cookie));
assert.equal(res.status,201,'pantry create');
const pantryId=(await res.json()).id;
res=await raw('/pantry',opts);
assert.ok((await res.json()).items.some((i)=>i.id===pantryId),'pantry fetch');
res=await raw('/pantry',jsonOptions('POST',{productId:custom.id,quantity:-5,unitId:'pcs',locationId:'home'},cookie));
assert.equal(res.status,400,'invalid quantity blocked');
res=await raw('/pantry/'+pantryId,{method:'DELETE',headers:{Origin:BASE,Cookie:cookie}});
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
// If one product is invalid, NO valid product should have been written.
const before=groupedItems.length;
res=await raw('/shopping/bulk',jsonOptions('POST',{items:[
  {productId:selection[0].id,quantity:5,unitId:'pcs',note:'should-not-save'},
  {productId:'00000000-0000-4000-8000-000000000000',quantity:1,unitId:'pcs',note:''}
]},cookie));
assert.equal(res.status,400,'invalid bulk product blocked');
res=await raw('/shopping',opts);
assert.equal((await res.json()).items.length,before,'invalid batch not partially written');
res=await raw('/auth/logout',{method:'POST',headers:{Origin:BASE,Cookie:cookie}});
assert.equal(res.status,200,'logout');
res=await raw('/shopping',opts);
assert.equal(res.status,401,'logout revoked session');
console.log('SMOKE_TEST_OK login, CSRF, sessions, catalog, variants, shopping, bulk atomics, duplicates, concurrency, pantry, validation');
