import { prisma } from '../db/client';
import { AppError } from '../middleware/errorHandler';
import { LoanStatus } from '@prisma/client';

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

function forbidden(message: string): never {
  const err = new Error(message) as AppError;
  err.statusCode = 403;
  throw err;
}

export async function borrow(userId: string, bookId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound('User not found');
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) notFound('Book not found');
  if (!book.available) badRequest('Book is not available');
  const activeLoan = await prisma.loan.findFirst({
    where: { bookId, status: 'ACTIVE' },
  });
  if (activeLoan) badRequest('Book is already on loan');

  const [loan] = await prisma.$transaction([
    prisma.loan.create({
      data: {
        userId,
        bookId,
        loanDate: new Date(),
        returnDate: null,
        status: 'ACTIVE',
      },
    }),
    prisma.book.update({
      where: { id: bookId },
      data: { available: false },
    }),
  ]);
  return loan;
}

export async function returnLoan(loanId: string, requesterId: string, requesterRole: 'USER' | 'ADMIN') {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) notFound('Loan not found');
  if (requesterRole !== 'ADMIN' && loan.userId !== requesterId) {
    forbidden('Forbidden');
  }
  if (loan.status === 'RETURNED') badRequest('Loan already returned');

  const returnDate = new Date();
  const [updated] = await prisma.$transaction([
    prisma.loan.update({
      where: { id: loanId },
      data: { status: 'RETURNED' as LoanStatus, returnDate },
    }),
    prisma.book.update({
      where: { id: loan.bookId },
      data: { available: true },
    }),
  ]);
  return updated;
}
