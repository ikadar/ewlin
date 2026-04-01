import express, { type Express } from 'express';
import { loggerMiddleware } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { createChatRouter } from './routes/chat.js';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '5mb' }));
  app.use(loggerMiddleware);

  // CORS for local development
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Routes
  app.use(healthRouter);
  app.use(createChatRouter());

  // Error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
