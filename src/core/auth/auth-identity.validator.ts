import { type Role, ROLE_VALUES } from '@shared/enums';

import { AUTH_EMAIL_PATTERN } from './auth.constants';
import type { AuthUserIdentity } from './auth.types';

const ROLE_VALUE_SET: ReadonlySet<unknown> = new Set(ROLE_VALUES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRole(value: unknown): value is Role {
  return ROLE_VALUE_SET.has(value);
}

export function isAuthUserIdentity(value: unknown): value is AuthUserIdentity {
  if (!isRecord(value)) {
    return false;
  }

  const userId = value['userId'];
  const email = value['email'];
  return (
    typeof userId === 'string' &&
    userId.trim().length > 0 &&
    typeof email === 'string' &&
    AUTH_EMAIL_PATTERN.test(email) &&
    Array.isArray(value['roles']) &&
    value['roles'].every(isRole)
  );
}
