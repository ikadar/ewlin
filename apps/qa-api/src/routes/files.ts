import { Router, type IRouter } from 'express';
import { getFilesWithProgress } from '../services/file-service.js';

export const filesRouter: IRouter = Router();

// GET /qa-api/files/:folder - List files in folder with progress
filesRouter.get('/:folder', (req, res) => {
  try {
    const { folder } = req.params;
    const files = getFilesWithProgress(folder);
    res.json(files);
  } catch (error) {
    console.error('Failed to get files:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});
