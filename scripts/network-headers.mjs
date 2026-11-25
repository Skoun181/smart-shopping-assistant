import { isIP } from 'node:net';

/** @param {string|undefined} address */
const normalizeAddress = (address) => address?.replace(/^::ffff:/i, '') || '';
const localOrigin = /^(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(?::[0-9]{1,5})?$/;

/** @param {NodeJS.ProcessEnv} env */
export function ingressPolicy(env) {
  const peers = new Set((env.TRUSTED_PROXY_IPS ?? '').split(',').map(x => normalizeAddress(x.trim())).filter(Boolean));
  if ([...peers].some(peer => !isIP(peer))) throw Error('TRUSTED_PROXY_IPS must contain literal IP addresses');
  let origin;
  if (env.PUBLIC_ORIGIN) {
    origin = new URL(env.PUBLIC_ORIGIN);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== env.PUBLIC_ORIGIN)
      throw Error('PUBLIC_ORIGIN must be an HTTP(S) origin without a trailing slash');
    if (!peers.size) throw Error('PUBLIC_ORIGIN requires TRUSTED_PROXY_IPS');
  }
  return { peers, origin };
}

/**
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @param {string|undefined} remoteAddress
 * @param {ReturnType<typeof ingressPolicy>} policy
 */
export function prepareHeaders(headers, remoteAddress, policy = ingressPolicy({})) {
  const peer = normalizeAddress(remoteAddress);
  const trusted = policy.peers.has(peer);
  const scheme = (trusted ? headers['x-forwarded-proto'] : undefined) ?? 'http';
  const host = headers.host;
  if (typeof scheme !== 'string' || !['http', 'https'].includes(scheme)) return false;
  if (typeof host !== 'string' || !localOrigin.test(host)) return false;
  let url;
  try { url = new URL(scheme + '://' + host); } catch { return false; }
  if (trusted && policy.origin && url.origin !== policy.origin.origin) return false;
  const forwardedFrom = trusted ? headers['x-forwarded-for'] : undefined;
  const client = typeof forwardedFrom === 'string' && isIP(normalizeAddress(forwardedFrom.trim()))
    ? normalizeAddress(forwardedFrom.trim()) : peer;
  for (const key of Object.keys(headers)) {
    if (key === 'forwarded' || key === 'x-real-ip' || key.startsWith('x-forwarded-') || key.startsWith('x-ssa-')) delete headers[key];
  }
  headers.host = url.host;
  headers['x-ssa-protocol'] = scheme;
  headers['x-ssa-client-ip'] = client || 'unknown';
  return true;
}
