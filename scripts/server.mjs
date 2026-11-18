import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { prepareHeaders, trustedProxyPeer, localHost } from './network-headers.mjs';

// Legacy .env values are deliberately ignored. Only this gateway sets internal headers.
delete process.env.ORIGIN;
delete process.env.HOST_HEADER;
delete process.env.PORT_HEADER;
process.env.PROTOCOL_HEADER='x-ssa-protocol';
process.env.ADDRESS_HEADER='x-ssa-client-ip';
const trustedIP=process.env.TRUSTED_PROXY_IP||'';
if(trustedIP && (isIP(trustedIP)!==4 || !localHost(trustedIP))) throw new Error('TRUSTED_PROXY_IP must be a private IPv4 address');
const {handler}=await import('../build/handler.js');

function listener(proxy){
  return createServer({maxHeaderSize:16384},(req,res)=>{
    if(proxy&&!trustedProxyPeer(req.socket.remoteAddress,trustedIP)){
      res.writeHead(403,{'Cache-Control':'no-store'}).end('Untrusted proxy');return;
    }
    if(!prepareHeaders(req.headers,req.socket.remoteAddress,proxy)){
      res.writeHead(400,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('Invalid host or proxy protocol');
      return;
    }
    if(!req.url?.startsWith('/')||req.url.startsWith('//')||req.url.split('?')[0].includes('\\')){
      res.writeHead(400).end('Invalid request target');return;
    }
    handler(req,res);
  });
}
const direct=listener(false),trusted=listener(true);
const host=process.env.HOST||'0.0.0.0';
direct.listen(Number(process.env.PORT||3000),host,()=>console.log('Direct LAN HTTP listener ready'));
trusted.listen(3001,host,()=>console.log('Trusted proxy listener ready'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{
  for(const server of [direct,trusted]){server.close();server.closeAllConnections();}
});
