import { Router, type IRouter } from 'express';
import path from 'path';
import { getFileContent, getQABasePath } from '../services/file-service.js';
import { getTestStatus } from '../services/tracking-service.js';
import { getTestFullId } from '../parsers/markdown-parser.js';
import type { TestStatusEntry, TestStatus } from '../types/index.js';

export const contentRouter: IRouter = Router();

// GET /qa-api/content/:folder/:file - Get parsed file content with status
contentRouter.get('/:folder/:file', (req, res) => {
  try {
    const { folder, file } = req.params;
    const content = getFileContent(folder, file);

    if (!content) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Add status for each test
    const testsWithStatus = content.tests.map((test) => {
      const fullId = getTestFullId(folder, file, test.id);
      const statusEntry = getTestStatus(fullId);
      return {
        ...test,
        fullId,
        statusEntry: statusEntry || {
          status: 'untested' as TestStatus,
          lastTestedAt: '',
          results: {},
        },
      };
    });

    // Include absolute file path for editor integration
    const filePath = path.join(getQABasePath(), folder, file);

    res.json({
      ...content,
      filePath,
      tests: testsWithStatus,
    });
  } catch (error) {
    console.error('Failed to get content:', error);
    res.status(500).json({ error: 'Failed to get content' });
  }
});
