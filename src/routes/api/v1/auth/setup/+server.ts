import type { RequestHandler } from './$types';
import { z } from 'zod';
import { credentialState, setupPassword, newSession } from '#lib/server/auth.ts';
import { validSetupToken } from '#lib/server/setup-token.ts';
import { passwordValid } from '#lib/server/credentials.ts';
import { parsed, response } from '#lib/server/http.ts';

export const POST:RequestHandler=async(event)=>{
  if(credentialState()!=='setup')return response({error:'Setup is not available'},409);
  const {password,confirmation,setupToken}=await parsed(event,z.object({password:z.string().max(1024),confirmation:z.string().max(1024),setupToken:z.string().max(256).default('')}).strict());
  if(!passwordValid(password)||password!==confirmation)return response({error:'Password must have at least 12 characters (max 1024 bytes) and match confirmation'},400);
  if(!validSetupToken(setupToken))return response({error:'Invalid setup token'},403);
  // The transaction rechecks setup availability: two requests cannot set
  // different passwords or reset an already configured installation.
  if(!setupPassword(password))return response({error:'Setup is no longer available'},409);
  newSession(event.cookies,event.url.protocol==='https:');
  console.info('[auth] initial shared password configured');
  return response({ok:true},201);
};
