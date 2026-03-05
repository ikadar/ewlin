import { Router, type IRouter } from 'express';
import {
  getAllKOLogs,
  getKOLogsForTest,
  createKOLog,
  resolveKOLog,
  reopenKOLog,
  deleteKOLog,
} from '../services/tracking-service.js';
import type { CreateKOLogRequest } from '../types/index.js';

export const koLogsRouter: IRouter = Router();

// GET /qa-api/ko-logs - Get all KO logs
koLogsRouter.get('/', (req, res) => {
  try {
    const { testId } = req.query;
    const logs = testId
      ? getKOLogsForTest(testId as string)
      : getAllKOLogs();
    res.json(logs);
  } catch (error) {
    console.error('Failed to get KO logs:', error);
    res.status(500).json({ error: 'Failed to get KO logs' });
  }
});

// POST /qa-api/ko-logs - Create KO log entry
koLogsRouter.post('/', (req, res) => {
  try {
    const body = req.body as CreateKOLogRequest;

    if (!body.testId || !body.description) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!['blocker', 'major', 'minor'].includes(body.severity)) {
      res.status(400).json({ error: 'Invalid severity value' });
      return;
    }

    const entry = createKOLog(body);
    res.status(201).json(entry);
  } catch (error) {
    console.error('Failed to create KO log:', error);
    res.status(500).json({ error: 'Failed to create KO log' });
  }
});

// PUT /qa-api/ko-logs/:id/resolve - Resolve KO log
koLogsRouter.put('/:id/resolve', (req, res) => {
  try {
    const { id } = req.params;
    const entry = resolveKOLog(id);

    if (!entry) {
      res.status(404).json({ error: 'KO log not found' });
      return;
    }

    res.json(entry);
  } catch (error) {
    console.error('Failed to resolve KO log:', error);
    res.status(500).json({ error: 'Failed to resolve KO log' });
  }
});

// PUT /qa-api/ko-logs/:id/reopen - Reopen resolved KO log
koLogsRouter.put('/:id/reopen', (req, res) => {
  try {
    const { id } = req.params;
    const entry = reopenKOLog(id);

    if (!entry) {
      res.status(404).json({ error: 'KO log not found' });
      return;
    }

    res.json(entry);
  } catch (error) {
    console.error('Failed to reopen KO log:', error);
    res.status(500).json({ error: 'Failed to reopen KO log' });
  }
});

// DELETE /qa-api/ko-logs/:id - Delete KO log
koLogsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteKOLog(id);

    if (!deleted) {
      res.status(404).json({ error: 'KO log not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete KO log:', error);
    res.status(500).json({ error: 'Failed to delete KO log' });
  }
});
