import { Router, type IRouter } from 'express';
import { getSelection, saveSelection } from '../services/tracking-service.js';

export const selectionRouter: IRouter = Router();

// GET /qa-api/selection - Get current selection
selectionRouter.get('/', (_req, res) => {
  try {
    const selection = getSelection();
    res.json(
      selection || { selectedFolder: null, selectedFile: null, selectedTestId: null }
    );
  } catch (error) {
    console.error('Failed to get selection:', error);
    res.status(500).json({ error: 'Failed to get selection' });
  }
});

// PUT /qa-api/selection - Save selection
selectionRouter.put('/', (req, res) => {
  try {
    const { selectedFolder, selectedFile, selectedTestId } = req.body;
    const result = saveSelection({ selectedFolder, selectedFile, selectedTestId });
    res.json(result);
  } catch (error) {
    console.error('Failed to save selection:', error);
    res.status(500).json({ error: 'Failed to save selection' });
  }
});
