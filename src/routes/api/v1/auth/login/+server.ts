import type { RequestHandler } from './$types';
import { z } from 'zod';
import { checkPassword, clearFailures, loginAllowed, newSession, registerFailure } from '#lib/server/auth.ts';
import { parsed, response } from '#lib/server/http.ts';
export const POST: RequestHandler = async (event) => {
  const { password } = await parsed(event,z.object({password:z.string().min(1).max(1024)}).strict());
  const ip = event.getClientAddress();
  if (!loginAllowed(ip)) return response({error:'Too many attempts. Try again later.'},429);
  if (!checkPassword(password)) {
    registerFailure(ip);
    return response({error:'Invalid password'},401);
  }
  clearFailures(ip);
  newSession(event.cookies,event.url.protocol==='https:');
  return response({ok:true});
};
