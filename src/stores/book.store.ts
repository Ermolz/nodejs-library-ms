import { Book } from '../types/book';

const books = new Map<string, Book>();

export function getAll(): Book[] {
  return Array.from(books.values());
}

export function getById(id: string): Book | undefined {
  return books.get(id);
}

export function getByIsbn(isbn: string): Book | undefined {
  return getAll().find((b) => b.isbn === isbn);
}

export function create(data: Omit<Book, 'id' | 'available'>): Book {
  const id = crypto.randomUUID();
  const book: Book = {
    ...data,
    id,
    available: true,
  };
  books.set(id, book);
  return book;
}

export function update(id: string, data: Partial<Omit<Book, 'id'>>): Book | undefined {
  const existing = books.get(id);
  if (!existing) return undefined;
  const updated: Book = { ...existing, ...data };
  books.set(id, updated);
  return updated;
}

export function remove(id: string): boolean {
  return books.delete(id);
}
