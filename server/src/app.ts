import express, { type Express, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import env from './config/env.js';

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

export default app;