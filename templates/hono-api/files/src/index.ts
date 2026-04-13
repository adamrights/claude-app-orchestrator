import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { env } from './env';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error-handler';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/logger';
import { health } from './routes/health';

const app = new Hono();

app.use('*', requestId);
app.use('*', requestLogger);
app.onError(errorHandler);

app.route('/health', health);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, `{{name}} listening on http://localhost:${info.port}`);
});

export default app;
