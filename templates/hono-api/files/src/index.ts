import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { health } from './routes/health';

const app = new Hono();

app.route('/health', health);

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`{{name}} listening on http://localhost:${info.port}`);
});

export default app;
