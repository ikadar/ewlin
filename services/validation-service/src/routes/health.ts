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
    service: 'validation-service',
    version: '0.2.7',
  };

  res.json(response);
});

export const healthRouter: RouterType = router;
