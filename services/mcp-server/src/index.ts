import { createApp } from './app.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;

const app = createApp();

app.listen(PORT, () => {
  console.log(`[mcp-server] AI Scheduler Assistant running on port ${PORT}`);
  console.log(`[mcp-server] Health check: http://localhost:${PORT}/health`);
});
