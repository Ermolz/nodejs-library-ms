import { Loan } from '../types/loan';
import * as bookStore from '../stores/book.store';
import * as userStore from '../stores/user.store';
import * as loanStore from '../stores/loan.store';
import { AppError } from '../middleware/errorHandler';

function badRequest(message: string): never {
  const err = new Error(message) as AppError;
  err.statusCode = 400;
  throw err;
}

function notFound(message: string): never {
  const err = new Error(message) as AppError;
  err.statusCode = 404;
  throw err;
}

export function borrow(userId: string, bookId: string): Loan {
  const user = userStore.getById(userId);
  if (!user) notFound('User not found');
  const book = bookStore.getById(bookId);
  if (!book) notFound('Book not found');
  if (!book.available) badRequest('Book is not available');
  const activeLoan = loanStore.findActiveByBookId(bookId);
  if (activeLoan) badRequest('Book is already on loan');

  const loan = loanStore.create({
    userId,
    bookId,
    loanDate: new Date(),
    returnDate: null,
    status: 'ACTIVE',
  });
  bookStore.update(bookId, { available: false });
  return loan;
}

export function returnLoan(loanId: string): Loan {
  const loan = loanStore.getById(loanId);
  if (!loan) notFound('Loan not found');
  if (loan.status === 'RETURNED') badRequest('Loan already returned');

  const returnDate = new Date();
  const updated = loanStore.update(loanId, { status: 'RETURNED', returnDate });
  bookStore.update(loan.bookId, { available: true });
  return updated!;
}
