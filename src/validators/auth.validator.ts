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

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
