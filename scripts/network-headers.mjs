import { isIP } from 'node:net';

/** @param {string} hostname */
export function localHost(hostname) {
  const h=hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if(h==='localhost')return true;
  if(isIP(h)===4){
    const [a,b]=h.split('.').map(Number);
    return a===10||a===127||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===169&&b===254);
  }
  return isIP(h)===6&&(h==='::1'||/^f[cd][0-9a-f]{2}:/.test(h)||/^fe[89ab][0-9a-f]:/.test(h));
}
/** @param {import('node:http').IncomingHttpHeaders} headers @param {string | undefined} remoteAddress @param {boolean} [proxy] */
export function prepareHeaders(headers,remoteAddress,proxy=false) {
  const scheme=proxy?headers['x-forwarded-proto']:'http';
  const real=proxy?headers['x-real-ip']:undefined;
  const host=headers.host;
  if(typeof scheme!=='string'||!['http','https'].includes(scheme))return false;
  if(typeof host!=='string'||!/^(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(?::[0-9]{1,5})?$/.test(host))return false;
  let url;
  try{url=new URL(scheme+'://'+host);}catch{return false;}
  if(!proxy&&!localHost(url.hostname))return false;
  // Never let caller-supplied forwarding headers reach the application.
  for(const key of Object.keys(headers)){
    if(key==='forwarded'||key==='x-real-ip'||key.startsWith('x-forwarded-')||key.startsWith('x-ssa-'))delete headers[key];
  }
  headers.host=url.host;
  headers['x-ssa-protocol']=scheme;
  headers['x-ssa-client-ip']=typeof real==='string'&&isIP(real)?real:remoteAddress||'unknown';
  return true;
}
