import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { bookCreateSchema, bookUpdateSchema } from '../validators/book.validator';
import { prisma } from '../db/client';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const books = await prisma.book.findMany();
  res.json(books);
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }
  res.json(book);
});

router.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(bookCreateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const existing = await prisma.book.findUnique({ where: { isbn: req.body.isbn } });
    if (existing) {
      res.status(400).json({ error: 'Book with this ISBN already exists' });
      return;
    }
    const book = await prisma.book.create({
      data: {
        title: req.body.title,
        author: req.body.author,
        year: req.body.year,
        isbn: req.body.isbn,
        available: true,
      },
    });
    res.status(201).json(book);
  }
);

router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  validate(bookUpdateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: req.body,
    }).catch(() => null);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    res.json(book);
  }
);

router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.book.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Book not found' });
  }
});

export default router;
