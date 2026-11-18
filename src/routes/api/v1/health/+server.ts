import type { RequestHandler } from './$types';
import { database } from '$lib/server/db';
import { response } from '$lib/server/http';
export const GET: RequestHandler = () => {
  database().prepare('SELECT 1').get();
  return response({ ok:true, version:'0.1.0-beta.1' });
};
