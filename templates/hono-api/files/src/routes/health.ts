import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { logger } from '@/lib/logger';

export const health = new Hono();

/**
 * Liveness + readiness in one endpoint:
 *   200 { status: 'ok', db: 'up' }        — healthy
 *   503 { status: 'degraded', db: 'down' } — DB unreachable
 *
 * Load balancers should treat non-200 as "remove from rotation".
 */
health.get('/', async (c) => {
  let dbUp = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbUp = true;
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : err },
      'health check: database unreachable',
    );
  }

  if (!dbUp) {
    return c.json({ status: 'degraded', db: 'down' } as const, 503);
  }
  return c.json({ status: 'ok', db: 'up' } as const);
});
