import { Router, type IRouter } from 'express';
import {
  getAllTestStatuses,
  updateResultStatus,
} from '../services/tracking-service.js';
import type { UpdateStatusRequest } from '../types/index.js';

export const statusRouter: IRouter = Router();

// GET /qa-api/status - Get all test statuses
statusRouter.get('/', (_req, res) => {
  try {
    const statuses = getAllTestStatuses();
    res.json(statuses);
  } catch (error) {
    console.error('Failed to get statuses:', error);
    res.status(500).json({ error: 'Failed to get statuses' });
  }
});

// PUT /qa-api/status - Update single result status
statusRouter.put('/', (req, res) => {
  try {
    const { testId, resultIndex, status } = req.body as UpdateStatusRequest;

    if (!testId || resultIndex === undefined || !status) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!['untested', 'ok', 'ko'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value' });
      return;
    }

    const entry = updateResultStatus(testId, resultIndex, status);
    res.json(entry);
  } catch (error) {
    console.error('Failed to update status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});
