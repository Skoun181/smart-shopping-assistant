import type { RequestHandler } from './$types';
import { deleteSession } from '#lib/server/auth.ts';
import { response } from '#lib/server/http.ts';
export const POST: RequestHandler = ({cookies}) => {
  deleteSession(cookies);
  return response({ok:true});
};
