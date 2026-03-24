import { z } from 'zod';

export const loanCreateSchema = z.object({
  bookId: z.string().min(1),
});

export type LoanCreateInput = z.infer<typeof loanCreateSchema>;
