import { z } from 'zod';

export const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
