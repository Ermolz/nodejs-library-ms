import express from 'express';
import path from 'path';
import { mkdirSync } from 'fs';
import { Request, Response } from 'express';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import booksRoutes from './routes/books.routes';
import usersRoutes from './routes/users.routes';
import loansRoutes from './routes/loans.routes';

const app = express();
const uploadsDirectory = path.join(process.cwd(), 'uploads');
const avatarsDirectory = path.join(uploadsDirectory, 'avatars');

mkdirSync(avatarsDirectory, { recursive: true });

app.use(express.json());
app.use('/uploads', express.static(uploadsDirectory));

app.use('/auth', authRoutes);
app.use('/books', booksRoutes);
app.use('/users', usersRoutes);
app.use('/loans', loansRoutes);

app.use('*', (_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

export default app;
