import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { bookCreateSchema, bookUpdateSchema } from '../validators/book.validator';
import * as bookStore from '../stores/book.store';

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  res.json(bookStore.getAll());
});

router.get('/:id', (req: Request, res: Response): void => {
  const book = bookStore.getById(req.params.id);
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }
  res.json(book);
});

router.post('/', validate(bookCreateSchema), (req: Request, res: Response): void => {
  const existing = bookStore.getByIsbn(req.body.isbn);
  if (existing) {
    res.status(400).json({ error: 'Book with this ISBN already exists' });
    return;
  }
  const book = bookStore.create(req.body);
  res.status(201).json(book);
});

router.put('/:id', validate(bookUpdateSchema), (req: Request, res: Response): void => {
  const book = bookStore.update(req.params.id, req.body);
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }
  res.json(book);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = bookStore.remove(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }
  res.status(204).send();
});

export default router;
