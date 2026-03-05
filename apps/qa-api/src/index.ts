import express from 'express';
import cors from 'cors';
import { foldersRouter } from './routes/folders.js';
import { filesRouter } from './routes/files.js';
import { contentRouter } from './routes/content.js';
import { statusRouter } from './routes/status.js';
import { koLogsRouter } from './routes/ko-logs.js';
import { fixtureRequestsRouter } from './routes/fixture-requests.js';
import { rawRouter } from './routes/raw.js';
import { selectionRouter } from './routes/selection.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/qa-api/folders', foldersRouter);
app.use('/qa-api/files', filesRouter);
app.use('/qa-api/content', contentRouter);
app.use('/qa-api/status', statusRouter);
app.use('/qa-api/ko-logs', koLogsRouter);
app.use('/qa-api/fixture-requests', fixtureRequestsRouter);
app.use('/qa-api/raw', rawRouter);
app.use('/qa-api/selection', selectionRouter);

// Health check
app.get('/qa-api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`QA API server running on port ${PORT}`);
});
