import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { JwtPayload } from '../types/user';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return secret;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header') as AppError;
    err.statusCode = 401;
    return next(err);
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    const err = new Error('Invalid or expired token') as AppError;
    err.statusCode = 401;
    return next(err);
  }
}
