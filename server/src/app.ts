import express, { type Express, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import env from './config/env.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import AppError from './utils/AppError.js';

const app: Express = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrls, credentials: true }));
app.use(express.json({ limit: '100kb' }));

if (!env.isProduction) {
  app.use(morgan('dev'));
}

app.get('/api/health', (_req: Request, res: Response) => {
  const dbConnected = mongoose.connection.readyState === 1;

  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    status: dbConnected ? 'ok' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});
// ⚠️ TEMPORARY test routes, delete after testing
app.get('/api/test/app-error', () => {
  throw new AppError('Product not found', 404);
});

app.get('/api/test/form-error', () => {
  throw new AppError('Please check your details', 400, [
    { field: 'phone', message: 'Enter a valid Pakistani mobile number' },
  ]);
});

app.get('/api/test/bug', () => {
  throw new Error('Secret internal detail: db password is abc123');
});

app.get('/api/test/async-bug', async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  throw new Error('Async failure');
});

app.use(notFound);
app.use(errorHandler);

export default app;