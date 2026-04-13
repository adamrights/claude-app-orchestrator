import { z } from 'zod';

/**
 * Zod-validated process environment.
 *
 * Import `env` from `@/env` anywhere you need an env var. Never read
 * `process.env.*` directly — that bypasses validation and typing.
 *
 * Validation runs on module load, so missing or malformed vars crash the
 * process immediately on startup (before the server binds to a port)
 * instead of surfacing as cryptic runtime errors later.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
