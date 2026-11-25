import { credentialState } from '#lib/server/auth.ts';
import { prepareSetupToken } from '#lib/server/setup-token.ts';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({locals}) => {
  if (locals.authenticated) redirect(303,'/');
  const loginState=credentialState();
  if(loginState==='setup')prepareSetupToken();
  return {loginState};
};
