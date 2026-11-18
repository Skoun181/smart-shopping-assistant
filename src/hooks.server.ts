import type { Handle } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { getSession } from '$lib/server/auth';
import { assertOrigin } from '$lib/server/http';

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  event.locals.sessionTokenHash = getSession(event.cookies);
  event.locals.authenticated = !!event.locals.sessionTokenHash;
  if (path.startsWith('/api/') && path !== '/api/v1/auth/login' && path !== '/api/v1/health' && !event.locals.authenticated) {
    throw error(401,'Login required');
  }
  if (path.startsWith('/api/') && !['GET','HEAD','OPTIONS'].includes(event.request.method)) assertOrigin(event);
  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('Referrer-Policy','no-referrer');
  response.headers.set('X-Frame-Options','DENY');
  response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  response.headers.set('Cache-Control',path.startsWith('/api/') ? 'no-store' : 'private, no-store');
  return response;
};
