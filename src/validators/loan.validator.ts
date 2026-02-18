import { z } from 'zod';

export const loanCreateSchema = z.object({
  userId: z.string().uuid(),
  bookId: z.string().uuid(),
});

export type LoanCreateInput = z.infer<typeof loanCreateSchema>;
