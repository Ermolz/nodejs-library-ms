import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, refreshSchema } from '../validators/auth.validator';
import * as authService from '../services/auth.service';

const router = Router();

router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.refresh(req.body.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
