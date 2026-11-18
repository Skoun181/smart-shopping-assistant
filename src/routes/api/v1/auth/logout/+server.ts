import type { RequestHandler } from './$types';
import { deleteSession } from '#lib/server/auth.ts';
import { response } from '#lib/server/http.ts';
export const POST: RequestHandler = ({cookies,url}) => {
  deleteSession(cookies,url.protocol==='https:');
  return response({ok:true});
};
