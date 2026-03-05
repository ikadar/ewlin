import { Router, type IRouter } from 'express';
import fs from 'fs';
import path from 'path';
import { getQABasePath } from '../services/file-service.js';

export const rawRouter: IRouter = Router();

// GET /qa-api/raw/:folder/:file - Get raw markdown content
rawRouter.get('/:folder/:file', (req, res) => {
  try {
    const { folder, file } = req.params;
    const filePath = path.join(getQABasePath(), folder, file);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, filePath });
  } catch (error) {
    console.error('Failed to read raw file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// PUT /qa-api/raw/:folder/:file - Save raw markdown content
rawRouter.put('/:folder/:file', (req, res) => {
  try {
    const { folder, file } = req.params;
    const { content } = req.body as { content: string };

    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const filePath = path.join(getQABasePath(), folder, file);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ success: true, filePath });
  } catch (error) {
    console.error('Failed to save raw file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});
