import express, { type Express } from 'express';
import { loggerMiddleware } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { compactRouter } from './routes/compact.js';

export function createApp(): Express {
  const app = express();

  // Middleware — 10mb limit for large schedule snapshots
  app.use(express.json({ limit: '10mb' }));
  app.use(loggerMiddleware);

  // Routes
  app.use(healthRouter);
  app.use(compactRouter);

  // Error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
