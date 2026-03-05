import { Router, type IRouter } from 'express';
import { getFoldersWithProgress } from '../services/file-service.js';

export const foldersRouter: IRouter = Router();

// GET /qa-api/folders - List all folders with progress
foldersRouter.get('/', (_req, res) => {
  try {
    const folders = getFoldersWithProgress();
    res.json(folders);
  } catch (error) {
    console.error('Failed to get folders:', error);
    res.status(500).json({ error: 'Failed to get folders' });
  }
});
