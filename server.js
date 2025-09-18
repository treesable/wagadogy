// Production server entry point
const { serve } = require('@hono/node-server');
const app = require('./backend/hono.ts').default;

const port = process.env.PORT || 3000;

console.log(`Starting server on port ${port}`);
serve({
  fetch: app.fetch,
  port: port,
});

console.log(`Server is running on http://localhost:${port}`);