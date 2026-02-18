import { Loan } from '../types/loan';

const loans = new Map<string, Loan>();

export function getAll(): Loan[] {
  return Array.from(loans.values());
}

export function getById(id: string): Loan | undefined {
  return loans.get(id);
}

export function findActiveByBookId(bookId: string): Loan | undefined {
  return getAll().find((l) => l.bookId === bookId && l.status === 'ACTIVE');
}

export function create(data: Omit<Loan, 'id'>): Loan {
  const id = crypto.randomUUID();
  const loan: Loan = { ...data, id };
  loans.set(id, loan);
  return loan;
}

export function update(id: string, data: Partial<Omit<Loan, 'id'>>): Loan | undefined {
  const existing = loans.get(id);
  if (!existing) return undefined;
  const updated: Loan = { ...existing, ...data };
  loans.set(id, updated);
  return updated;
}
