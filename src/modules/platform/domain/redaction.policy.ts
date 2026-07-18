import {
  REDACTED_VALUE,
  REDACTION_DENY_SUBSTRINGS,
} from '../model/platform.constants';
import type { JsonScalar, ScalarPayload } from '../model/platform.types';

/**
 * Pure redaction for audit diffs, event payloads, and notification params. A key
 * whose (lowercased, separator-stripped) name contains any denied substring has
 * its value masked. Payloads are scalar-only by type, so file bytes, private
 * notes, and nested PII graphs cannot enter the ledger in the first place; this
 * masks the remaining sensitive scalar fields (tokens, contacts, health, …).
 */

function normalizeKey(key: string): string {
  return key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
}

/** True when the field name matches a denied substring and must be masked. */
export function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return REDACTION_DENY_SUBSTRINGS.some(denied =>
    normalized.includes(normalizeKey(denied)),
  );
}

/** Return a copy of the payload with every sensitive field value masked. */
export function redactScalarPayload(payload: ScalarPayload): ScalarPayload {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]): [string, JsonScalar] => [
      key,
      isSensitiveKey(key) ? REDACTED_VALUE : value,
    ]),
  );
}
