import express, { type Express } from 'express';
import { loggerMiddleware } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(loggerMiddleware);

  // Routes
  app.use(healthRouter);

  // Error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
