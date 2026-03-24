import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    const err = new Error('Unauthorized') as AppError;
    err.statusCode = 401;
    return next(err);
  }
  if (req.user.role !== 'ADMIN') {
    const err = new Error('Forbidden') as AppError;
    err.statusCode = 403;
    return next(err);
  }
  next();
}
