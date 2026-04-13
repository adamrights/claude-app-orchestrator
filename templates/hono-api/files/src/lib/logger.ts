/**
 * Minimal structured logger with a pino-compatible shape.
 *
 * Emits JSON lines so log aggregators (Datadog, CloudWatch, Loki) can index
 * the fields directly. The API intentionally mirrors `pino` so swapping this
 * stub for the real thing later is a one-line change:
 *
 *   import pino from 'pino';
 *   export const logger = pino({ level: env.LOG_LEVEL });
 */
type Fields = Record<string, unknown>;
type Level = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(fields: Fields, msg?: string): void;
  info(fields: Fields, msg?: string): void;
  warn(fields: Fields, msg?: string): void;
  error(fields: Fields, msg?: string): void;
}

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const raw = process.env.LOG_LEVEL as Level | undefined;
  return LEVEL_ORDER[raw ?? 'info'] ?? LEVEL_ORDER.info;
}

function emit(level: Level, fields: Fields, msg?: string): void {
  if (LEVEL_ORDER[level] < threshold()) return;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    msg,
    ...fields,
  });
  if (level === 'error' || level === 'warn') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger: Logger = {
  debug: (fields, msg) => emit('debug', fields, msg),
  info: (fields, msg) => emit('info', fields, msg),
  warn: (fields, msg) => emit('warn', fields, msg),
  error: (fields, msg) => emit('error', fields, msg),
};
