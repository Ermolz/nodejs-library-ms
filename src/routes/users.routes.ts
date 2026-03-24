import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { prisma } from '../db/client';

function toUserResponse(user: { id: string; name: string; email: string; role: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

const router = Router();

router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(toUserResponse(user));
});

router.get('/', requireAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(users.map(toUserResponse));
});

router.get('/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(toUserResponse(user));
});

export default router;
