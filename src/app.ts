import express from 'express';
import { Request, Response } from 'express';
import { errorHandler } from './middleware/errorHandler';
import booksRoutes from './routes/books.routes';
import usersRoutes from './routes/users.routes';
import loansRoutes from './routes/loans.routes';

const app = express();

app.use(express.json());

app.use('/books', booksRoutes);
app.use('/users', usersRoutes);
app.use('/loans', loansRoutes);

app.use('*', (_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

export default app;
