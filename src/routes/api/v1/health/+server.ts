import type { RequestHandler } from './$types';
import { database } from '#lib/server/db.ts';
import { response } from '#lib/server/http.ts';
export const GET: RequestHandler = () => {
  database().prepare('SELECT 1').get();
  return response({ ok:true, version:'0.3.1-beta.1' });
};
