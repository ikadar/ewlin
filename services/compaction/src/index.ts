import { createApp } from './app.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;

const app = createApp();

app.listen(PORT, () => {
  console.log(`[compaction-service] Server running on port ${PORT}`);
  console.log(`[compaction-service] Health check: http://localhost:${PORT}/health`);
});
