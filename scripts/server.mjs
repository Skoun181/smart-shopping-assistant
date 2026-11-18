import { createServer } from 'node:http';
import { prepareHeaders } from './network-headers.mjs';

// Legacy fixed-origin settings do not override the request's host and scheme.
delete process.env.ORIGIN;
delete process.env.HOST_HEADER;
delete process.env.PORT_HEADER;
process.env.PROTOCOL_HEADER='x-ssa-protocol';
process.env.ADDRESS_HEADER='x-ssa-client-ip';
const {handler}=await import('../build/handler.js');
const server=createServer({maxHeaderSize:16384},(req,res)=>{
  if(!prepareHeaders(req.headers,req.socket.remoteAddress)){
    res.writeHead(400,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('Invalid host or protocol');return;
  }
  if(!req.url?.startsWith('/')||req.url.startsWith('//')||req.url.split('?')[0].includes('\\')){
    res.writeHead(400).end('Invalid request target');return;
  }
  handler(req,res);
});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log('Shopping HTTP and reverse proxy listener ready'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeAllConnections();});
