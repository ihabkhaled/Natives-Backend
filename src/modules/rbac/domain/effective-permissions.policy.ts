import type { PermissionScope } from '@core/auth';

import { GrantEffect } from '../model/rbac.enums';
import type { PermissionGrant } from '../model/rbac.types';
import { grantCoversScope, grantIsInEffect } from './permission-scope.policy';

/**
 * Deterministically resolve the effective permission set from a flat list of
 * scoped, time-bounded grants for a single principal and request scope.
 *
 * Algorithm:
 *  1. Keep only grants that are in effect at `now` AND cover the request scope.
 *  2. Union all Allow grants into the allow set; union all Deny grants into the
 *     deny set.
 *  3. Effective = allow minus deny (deny always wins over allow).
 *
 * The result is order-independent (set union) and therefore deterministic for a
 * given input. Callers that need a stable list sort the returned keys.
 */
export function resolveEffectivePermissions(
  grants: readonly PermissionGrant[],
  scope: PermissionScope,
  now: Date,
): ReadonlySet<string> {
  const allow = new Set<string>();
  const deny = new Set<string>();
  for (const grant of grants) {
    if (!grantIsInEffect(grant, now) || !grantCoversScope(grant, scope)) {
      continue;
    }
    if (grant.effect === GrantEffect.Deny) {
      deny.add(grant.permission);
    } else {
      allow.add(grant.permission);
    }
  }
  for (const denied of deny) {
    allow.delete(denied);
  }
  return allow;
}
