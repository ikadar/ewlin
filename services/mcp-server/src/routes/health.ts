import { Router, type Router as RouterType } from 'express';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  service: string;
  version: string;
}

const router: RouterType = Router();

router.get('/health', (_req, res) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'mcp-server',
    version: '0.1.0',
  };

  res.json(response);
});

export const healthRouter: RouterType = router;
