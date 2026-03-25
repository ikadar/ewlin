import { Router, type Router as RouterType } from 'express';

const router: RouterType = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'compaction-service',
    version: '0.1.0',
  });
});

export const healthRouter: RouterType = router;
