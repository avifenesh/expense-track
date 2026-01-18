/* eslint-disable no-console -- This is the designated logging module */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'refreshToken',
  'accessToken',
  'apiKey',
  'authorization',
  'credential',
];

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitize(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
  if (!__DEV__) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const sanitizedContext = context ? sanitize(context) : undefined;

  const logFn =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'debug'
          ? console.debug
          : console.info;

  if (error) {
    logFn(prefix, message, sanitizedContext ?? '', formatError(error));
  } else if (sanitizedContext) {
    logFn(prefix, message, sanitizedContext);
  } else {
    logFn(prefix, message);
  }
}

export const logger = {
  error: (message: string, error?: unknown, context?: LogContext) =>
    log('error', message, context, error),
  warn: (message: string, error?: unknown, context?: LogContext) =>
    log('warn', message, context, error),
  info: (message: string, context?: LogContext) => log('info', message, context),
  debug: (message: string, context?: LogContext) => log('debug', message, context),
};
