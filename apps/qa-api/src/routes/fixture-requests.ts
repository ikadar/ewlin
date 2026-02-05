import { Router, type IRouter } from 'express';
import {
  getAllFixtureRequests,
  getFixtureRequestsForTest,
  createFixtureRequest,
  updateFixtureRequestStatus,
} from '../services/tracking-service.js';
import type { CreateFixtureRequestRequest } from '../types/index.js';

export const fixtureRequestsRouter: IRouter = Router();

// GET /qa-api/fixture-requests - Get all fixture requests
fixtureRequestsRouter.get('/', (req, res) => {
  try {
    const { testId } = req.query;
    const requests = testId
      ? getFixtureRequestsForTest(testId as string)
      : getAllFixtureRequests();
    res.json(requests);
  } catch (error) {
    console.error('Failed to get fixture requests:', error);
    res.status(500).json({ error: 'Failed to get fixture requests' });
  }
});

// POST /qa-api/fixture-requests - Create fixture request
fixtureRequestsRouter.post('/', (req, res) => {
  try {
    const body = req.body as CreateFixtureRequestRequest;

    if (!body.testId || !body.fixture || !body.requestedChange) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const entry = createFixtureRequest(body);
    res.status(201).json(entry);
  } catch (error) {
    console.error('Failed to create fixture request:', error);
    res.status(500).json({ error: 'Failed to create fixture request' });
  }
});

// PUT /qa-api/fixture-requests/:id/status - Update fixture request status
fixtureRequestsRouter.put('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: 'pending' | 'implemented' | 'rejected' };

    if (!status || !['pending', 'implemented', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value' });
      return;
    }

    const entry = updateFixtureRequestStatus(id, status);

    if (!entry) {
      res.status(404).json({ error: 'Fixture request not found' });
      return;
    }

    res.json(entry);
  } catch (error) {
    console.error('Failed to update fixture request:', error);
    res.status(500).json({ error: 'Failed to update fixture request' });
  }
});
