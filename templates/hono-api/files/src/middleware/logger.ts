import { createMiddleware } from 'hono/factory';
import { logger as log } from '@/lib/logger';

/**
 * Structured request logger. Emits one JSON line per request with:
 *   { requestId, method, path, status, durationMs }
 *
 * Attach after `requestId` so the correlation id is available.
 */
export const requestLogger = createMiddleware(async (c, next) => {
  const start = Date.now();
  const requestId = c.get('requestId' as never) as string | undefined;
  const method = c.req.method;
  const path = c.req.path;

  try {
    await next();
  } finally {
    const durationMs = Date.now() - start;
    log.info(
      {
        requestId,
        method,
        path,
        status: c.res.status,
        durationMs,
      },
      'request',
    );
  }
});
