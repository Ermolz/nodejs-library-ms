import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { loanCreateSchema } from '../validators/loan.validator';
import * as loanStore from '../stores/loan.store';
import * as loanService from '../services/loan.service';
const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  res.json(loanStore.getAll());
});

router.post('/', validate(loanCreateSchema), (req: Request, res: Response, next: NextFunction): void => {
  try {
    const loan = loanService.borrow(req.body.userId, req.body.bookId);
    res.status(201).json(loan);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/return', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const loan = loanService.returnLoan(req.params.id);
    res.json(loan);
  } catch (err) {
    next(err);
  }
});

export default router;
