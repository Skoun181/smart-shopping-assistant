import { error, json, type RequestEvent } from '@sveltejs/kit';
import { z, ZodError } from 'zod';

export const quantity = z.number().finite().positive().max(1000000);
export const name = z.string().trim().min(1).max(120);
export const note = z.string().trim().max(300);
export const uuid = z.string().uuid();
export const listItemBody = z.object({
  productId: uuid,
  variantId: uuid.nullable().optional(),
  quantity,
  unitId: z.enum(['pcs','pack','g','kg','ml','l']),
  note: note.default('')
}).strict();
export const changeBody = z.object({
  quantity: quantity.optional(),
  checked: z.boolean().optional(),
  note: note.optional(),
  expectedVersion: z.number().int().positive()
}).strict();
export const pantryBody = z.object({
  productId: uuid,
  variantId: uuid.nullable().optional(),
  locationId: z.string().max(40).default('home'),
  quantity,
  unitId: z.enum(['pcs','pack','g','kg','ml','l'])
}).strict();

export function assertOrigin(event: RequestEvent): void {
  const actual = event.request.headers.get('origin');
  if (!actual || actual !== event.url.origin) throw error(403,'Invalid origin');
}
export async function parsed<T extends z.ZodType>(event: RequestEvent,schema: T): Promise<z.infer<T>> {
  const contentType = event.request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) throw error(415,'JSON required');
  const raw = await event.request.text();
  if (raw.length > 8192) throw error(413,'Request too large');
  try { return schema.parse(JSON.parse(raw)); }
  catch (cause) {
    if (cause instanceof SyntaxError || cause instanceof ZodError) throw error(400,'Invalid input');
    throw cause;
  }
}
export function response(value: unknown, status=200) {
  return json(value,{status,headers:{'Cache-Control':'no-store'}});
}
export function unknownError(cause: unknown): never {
  if (cause instanceof Error && cause.message.includes('FOREIGN KEY')) throw error(400,'Invalid reference');
  throw cause;
}
