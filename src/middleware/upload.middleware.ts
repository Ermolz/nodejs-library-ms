import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Avatar must be a JPEG or PNG image'));
      return;
    }
    cb(null, true);
  },
});

function badRequest(message: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = 400;
  return err;
}

export function uploadAvatar(req: Request, res: Response, next: NextFunction): void {
  upload.single('avatar')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(badRequest('Avatar must be 5 MB or smaller'));
      return;
    }

    if (err instanceof Error) {
      next(badRequest(err.message));
      return;
    }

    next(err as AppError);
  });
}
