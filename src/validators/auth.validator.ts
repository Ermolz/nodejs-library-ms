import { z } from 'zod';

const passwordSchema = z.string().min(8);

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

