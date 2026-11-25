// @ts-nocheck — runtime integration harness
import assert from 'node:assert/strict';
import { request } from 'node:http';
const password='ci-testing-password-very-long';
function call(port,host,path,origin,extra={},body){
  return new Promise((resolve,reject)=>{
    const options={hostname:'127.0.0.1',port,path,method:body===undefined?'GET':'POST',headers:{Host:host,...(origin?{Origin:origin}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...extra}};
    const req=request(options,res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));res.on('error',reject);
    });
    req.setTimeout(10000,()=>req.destroy(Error('Timeout')));
    req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
}
const direct='192.168.0.150:3000',domain='list.xc.local';
const login='/api/v1/auth/login',logout='/api/v1/auth/logout';
let r=await call(3333,direct,login,'http://'+direct,{}, {password});
assert.equal(r.status,200,'direct IP login');
assert.match(r.headers['set-cookie'][0],/^shopping_session=/);
assert.doesNotMatch(r.headers['set-cookie'][0],/;\s*Secure\b/i);
const directCookie=r.headers['set-cookie'][0].split(';')[0];
r=await call(3333,direct,'/api/v1/catalog',undefined,{Cookie:directCookie});
assert.equal(r.status,200);
r=await call(3333,direct,login,'http://other.example',{}, {password});
assert.equal(r.status,403,'cross-origin blocked');
r=await call(3333,domain,login,'http://'+domain,{'X-Forwarded-Proto':'http'},{password});
assert.equal(r.status,200,'HTTP proxy login on same port');
assert.match(r.headers['set-cookie'][0],/^shopping_session=/);
if(process.env.EXPECT_TRUSTED_PROXY!=='1'){
  const denied=await call(3333,domain,login,'https://'+domain,{'X-Forwarded-Proto':'https'},{password});
  assert.equal(denied.status,403,'direct client cannot claim proxy HTTPS');
  console.log('NETWORK_SMOKE_OK direct HTTP and untrusted proxy headers');
  process.exit(0);
}
r=await call(3333,domain,login,'https://'+domain,{'X-Forwarded-Proto':'https'},{password});
assert.equal(r.status,200,'HTTPS proxy login on same port');
const secure=r.headers['set-cookie'][0];
assert.match(secure,/^__Host-shopping_session=/);
assert.match(secure,/;\s*Secure\b/i);
assert.match(secure,/;\s*HttpOnly\b/i);
const cookie=secure.split(';')[0];
r=await call(3333,domain,'/api/v1/catalog',undefined,{'X-Forwarded-Proto':'https',Cookie:cookie});
assert.equal(r.status,200);
r=await call(3333,domain,logout,'http://'+domain,{'X-Forwarded-Proto':'https',Cookie:cookie},{});
assert.equal(r.status,403,'wrong scheme rejected');
r=await call(3333,domain,logout,'https://'+domain,{'X-Forwarded-Proto':'https',Cookie:cookie},{});
assert.equal(r.status,200);
r=await call(3333,domain,login,'https://'+domain,{'X-Forwarded-Proto':'https,http'}, {password});
assert.equal(r.status,400,'invalid forwarded protocol rejected');
console.log('NETWORK_SMOKE_OK single port direct IP, HTTP/HTTPS proxy, sessions and CSRF');
