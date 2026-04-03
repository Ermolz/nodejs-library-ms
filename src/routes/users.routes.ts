import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { uploadAvatar } from '../middleware/upload.middleware';
import { AppError } from '../middleware/errorHandler';
import { toUserResponse } from '../utils/userResponse';

const router = Router();
const avatarsDirectory = path.join(process.cwd(), 'uploads', 'avatars');

function notFound(message: string): never {
  const err = new Error(message) as AppError;
  err.statusCode = 404;
  throw err;
}

function badRequest(message: string): never {
  const err = new Error(message) as AppError;
  err.statusCode = 400;
  throw err;
}

function avatarUrlToPath(avatarUrl: string): string {
  const fileName = path.basename(avatarUrl);
  return path.join(avatarsDirectory, fileName);
}

async function deleteAvatarFile(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl) return;
  try {
    await fs.unlink(avatarUrlToPath(avatarUrl));
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code !== 'ENOENT') {
      throw err;
    }
  }
}

router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(toUserResponse(user));
});

router.post('/me/avatar', requireAuth, uploadAvatar, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      badRequest('Avatar file is required');
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, avatarUrl: true },
    });

    if (!currentUser) {
      notFound('User not found');
    }

    await fs.mkdir(avatarsDirectory, { recursive: true });

    const fileName = `${currentUser.id}-${Date.now()}.jpg`;
    const filePath = path.join(avatarsDirectory, fileName);
    const avatarBuffer = await sharp(req.file.buffer)
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 82 })
      .toBuffer();

    await fs.writeFile(filePath, avatarBuffer);

    const avatarUrl = `/uploads/avatars/${fileName}`;
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { avatarUrl },
    });

    await deleteAvatarFile(currentUser.avatarUrl);

    res.json({
      message: 'Аватарку успішно оновлено.',
      avatarUrl,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/me/avatar', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, avatarUrl: true },
    });

    if (!user) {
      notFound('User not found');
    }
    if (!user.avatarUrl) {
      notFound('Avatar not found');
    }

    await deleteAvatarFile(user.avatarUrl);
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: null },
    });

    res.json({ message: 'Аватарку видалено.' });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, avatarUrl: true },
  });
  res.json(users.map(toUserResponse));
});

router.get('/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(toUserResponse(user));
});

export default router;
