import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { env } from '@/env';
import { logger } from '@/lib/logger';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/**
 * Global error handler. Attach in src/index.ts with `app.onError(errorHandler)`.
 *
 * Distinguishes:
 * - ZodError        → 400, includes flattened `details`
 * - HTTPException   → uses its own status + message
 * - everything else → 500, message sanitized in production
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId' as never) as string | undefined;

  if (err instanceof ZodError) {
    logger.warn({ requestId, path: c.req.path, issues: err.issues }, 'validation error');
    const body: ErrorEnvelope = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten(),
        requestId,
      },
    };
    return c.json(body, 400);
  }

  if (err instanceof HTTPException) {
    const body: ErrorEnvelope = {
      error: {
        code: `HTTP_${err.status}`,
        message: err.message,
        requestId,
      },
    };
    logger.warn({ requestId, status: err.status, message: err.message }, 'http exception');
    return c.json(body, err.status);
  }

  logger.error(
    { requestId, err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
    'unhandled error',
  );

  const body: ErrorEnvelope = {
    error: {
      code: 'INTERNAL_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err instanceof Error
            ? err.message
            : 'Unknown error',
      requestId,
    },
  };
  return c.json(body, 500);
};
