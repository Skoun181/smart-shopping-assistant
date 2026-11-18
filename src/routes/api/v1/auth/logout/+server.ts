import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/auth';
import { response } from '$lib/server/http';
export const POST: RequestHandler = ({cookies}) => {
  deleteSession(cookies);
  return response({ok:true});
};
