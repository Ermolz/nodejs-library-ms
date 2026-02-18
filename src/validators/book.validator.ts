import { z } from 'zod';

export const bookCreateSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  year: z.number().int().min(1),
  isbn: z.string().min(1),
});

export const bookUpdateSchema = bookCreateSchema.partial();

export type BookCreateInput = z.infer<typeof bookCreateSchema>;
export type BookUpdateInput = z.infer<typeof bookUpdateSchema>;
