import { Router, type Request, type Response, type Router as RouterType } from 'express';
import type { ScheduleSnapshot } from '@flux/types';
import { CompactRequestSchema } from '../schemas/compact.js';
import { compact } from '../compact.js';
import type { CompactionProgress } from '../types.js';

const router: RouterType = Router();

router.post('/compact', (req: Request, res: Response) => {
  // Validate request body
  const parsed = CompactRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid request body',
      details: parsed.error.issues,
    });
    return;
  }

  // Cast Zod output to @flux/types (Zod uses nullish where types use optional)
  const snapshot = parsed.data.snapshot as unknown as ScheduleSnapshot;
  const { horizonHours } = parsed.data;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  req.socket.setNoDelay(true);
  res.flushHeaders();

  // Progress callback — writes SSE events to response
  const onProgress = (event: CompactionProgress): void => {
    const data = JSON.stringify(event);
    res.write(`data: ${data}\n\n`);
  };

  try {
    const result = compact(snapshot, horizonHours, onProgress);

    // Emit final complete event with result
    const completeEvent: CompactionProgress = {
      type: 'complete',
      phase: 'complete',
      stepsCompleted: 0,
      result,
    };
    const completeData = JSON.stringify(completeEvent);
    res.write(`data: ${completeData}\n\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[compact] Error:', message);
    const errorData = JSON.stringify({ type: 'error', message });
    res.write(`data: ${errorData}\n\n`);
  }

  res.end();
});

export const compactRouter: RouterType = router;
