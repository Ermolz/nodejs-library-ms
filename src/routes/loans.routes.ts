import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth.middleware';
import { loanCreateSchema } from '../validators/loan.validator';
import { prisma } from '../db/client';
import * as loanService from '../services/loan.service';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const isAdmin = req.user!.role === 'ADMIN';
  const loans = await prisma.loan.findMany({
    where: isAdmin ? undefined : { userId: req.user!.userId },
    include: { book: true, user: { select: { id: true, name: true, email: true } } },
  });
  res.json(loans);
});

router.post(
  '/',
  requireAuth,
  validate(loanCreateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loan = await loanService.borrow(req.user!.userId, req.body.bookId);
      res.status(201).json(loan);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/return', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const loan = await loanService.returnLoan(req.params.id, req.user!.userId, req.user!.role);
    res.json(loan);
  } catch (err) {
    next(err);
  }
});

export default router;

