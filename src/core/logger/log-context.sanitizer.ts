import {
  BEARER_LOG_PATTERN,
  BEARER_LOG_REPLACEMENT,
  CIRCULAR_LOG_VALUE,
  REDACT_CENSOR,
  SENSITIVE_LOG_ASSIGNMENT_PATTERN,
  SENSITIVE_LOG_ASSIGNMENT_REPLACEMENT,
  SENSITIVE_LOG_KEY_NAMES,
} from './logger.constants';
import type { LogContext } from './logger.port';

function normalizeKey(key: string): string {
  return key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
}

function isSensitiveKey(key: string): boolean {
  const normalizedKey = normalizeKey(key);
  return SENSITIVE_LOG_KEY_NAMES.some(sensitiveKey =>
    normalizedKey.includes(sensitiveKey),
  );
}

function sanitizeText(value: string): string {
  return value
    .replace(BEARER_LOG_PATTERN, BEARER_LOG_REPLACEMENT)
    .replace(
      SENSITIVE_LOG_ASSIGNMENT_PATTERN,
      SENSITIVE_LOG_ASSIGNMENT_REPLACEMENT,
    );
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value instanceof Error) {
    if (seen.has(value)) {
      return CIRCULAR_LOG_VALUE;
    }
    seen.add(value);
    return {
      name: value.name,
      message: sanitizeText(value.message),
      ...(value.stack === undefined
        ? {}
        : { stack: sanitizeText(value.stack) }),
      ...(value.cause === undefined
        ? {}
        : { cause: sanitizeValue(value.cause, seen) }),
    };
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return sanitizeText(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return CIRCULAR_LOG_VALUE;
    }
    seen.add(value);
    return value.map(item => sanitizeValue(item, seen));
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (seen.has(value)) {
    return CIRCULAR_LOG_VALUE;
  }
  seen.add(value);

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? REDACT_CENSOR : sanitizeValue(nestedValue, seen),
    ]),
  );
}

export function sanitizeLogContext(context: LogContext): LogContext {
  const seen = new WeakSet<object>();
  seen.add(context);
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      isSensitiveKey(key) ? REDACT_CENSOR : sanitizeValue(value, seen),
    ]),
  );
}
