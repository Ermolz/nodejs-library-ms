import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body) as z.infer<T>;
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        res.status(400).json({ error: message });
        return;
      }
      next(err);
    }
  };
}
