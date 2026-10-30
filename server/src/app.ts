import express, { type Express, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import env from './config/env.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';

const app: Express = express();

// 0. Server settings
if (env.isProduction) {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');

// 1. Security and parsing (run on every request)
app.use(helmet());
app.use(cors({ origin: env.clientUrls, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

if (!env.isProduction) {
  app.use(morgan('dev'));
}

// 2. Rate limit for all API routes
app.use('/api', apiLimiter);

// 3. Routes
app.get('/api/health', (_req: Request, res: Response) => {
  const dbConnected = mongoose.connection.readyState === 1;

  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    status: dbConnected ? 'ok' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});


app.use('/api/admin/auth', authRoutes);

// 4. Error handling (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;