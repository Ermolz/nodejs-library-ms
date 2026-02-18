import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { userCreateSchema } from '../validators/user.validator';
import * as userStore from '../stores/user.store';

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  res.json(userStore.getAll());
});

router.get('/:id', (req: Request, res: Response): void => {
  const user = userStore.getById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

router.post('/', validate(userCreateSchema), (req: Request, res: Response): void => {
  const user = userStore.create(req.body);
  res.status(201).json(user);
});

export default router;
