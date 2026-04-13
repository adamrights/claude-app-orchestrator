import { createMiddleware } from 'hono/factory';

const HEADER = 'x-request-id';

/**
 * Ensures every request has a stable `x-request-id`:
 * - If the client sent one, trust it (useful for tracing across services).
 * - Otherwise mint one via `crypto.randomUUID()`.
 *
 * The id is exposed two ways:
 * - `c.get('requestId')` for downstream middleware / handlers
 * - Echoed back on the response header so clients can correlate logs
 */
export const requestId = createMiddleware(async (c, next) => {
  const incoming = c.req.header(HEADER);
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  c.set('requestId' as never, id);
  c.header(HEADER, id);
  await next();
});
