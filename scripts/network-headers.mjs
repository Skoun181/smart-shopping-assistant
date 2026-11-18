/** Normalize the public authority and protocol for a single-port LAN deployment.
 * X-Forwarded-Proto is intentionally accepted from any LAN peer. Forwarded client
 * addresses are never used for login throttling.
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @param {string|undefined} remoteAddress
 */
export function prepareHeaders(headers,remoteAddress){
  const scheme=headers['x-forwarded-proto']??'http';
  const host=headers.host;
  if(typeof scheme!=='string'||!['http','https'].includes(scheme))return false;
  if(typeof host!=='string'||!/^(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(?::[0-9]{1,5})?$/.test(host))return false;
  let url;
  try{url=new URL(scheme+'://'+host);}catch{return false;}
  for(const key of Object.keys(headers)){
    if(key==='forwarded'||key==='x-real-ip'||key.startsWith('x-forwarded-')||key.startsWith('x-ssa-'))delete headers[key];
  }
  headers.host=url.host;
  headers['x-ssa-protocol']=scheme;
  headers['x-ssa-client-ip']=remoteAddress||'unknown';
  return true;
}
