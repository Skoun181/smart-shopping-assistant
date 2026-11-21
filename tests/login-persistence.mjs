// @ts-nocheck — runtime integration harness
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3333';
const password='ci-testing-password-very-long';
async function post(path,data){return fetch(base+'/api/v1/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(data)});}
let r;
if(process.argv[2]==='reset'){
  r=await post('login',{password});assert.equal(r.status,409);
  const replacement='ci-new-password-after-reset';
  r=await post('setup',{password:replacement,confirmation:replacement});assert.equal(r.status,201);
  r=await post('login',{password:replacement});assert.equal(r.status,200);
}else{
  r=await post('setup',{password,confirmation:password});assert.equal(r.status,409);
  r=await post('login',{password});assert.equal(r.status,200);
}
const cookie=r.headers.get('set-cookie').split(';')[0];
r=await fetch(base+'/api/v1/catalog',{headers:{Cookie:cookie}});assert.equal(r.status,200);
assert.ok((await r.json()).products.some(p=>p.name_de==='CI Testprodukt'),'existing application data preserved');
console.log('LOGIN_PERSISTENCE_OK',process.argv[2]||'recreate');
