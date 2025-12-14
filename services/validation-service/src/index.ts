import { createApp } from './app.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const app = createApp();

app.listen(PORT, () => {
  console.log(`[validation-service] Server running on port ${PORT}`);
  console.log(`[validation-service] Health check: http://localhost:${PORT}/health`);
});
