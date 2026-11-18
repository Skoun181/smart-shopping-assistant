import { z } from 'zod';

export const categoryName = z.string().trim().min(1).max(70);
export const categoryBody = z.object({
  nameDe: categoryName,
  nameEn: categoryName.optional()
}).strict();
