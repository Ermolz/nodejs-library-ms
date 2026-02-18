export type LoanStatus = 'ACTIVE' | 'RETURNED';

export interface Loan {
  id: string;
  userId: string;
  bookId: string;
  loanDate: Date;
  returnDate: Date | null;
  status: LoanStatus;
}
