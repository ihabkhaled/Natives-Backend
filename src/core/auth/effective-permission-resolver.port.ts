import type { AuthUserIdentity } from './auth.types';

/**
 * The team/season scope a request operates within. Both dimensions are optional:
 * an absent dimension means "global / not scoped to a specific team or season".
 * Scope values are extracted server-side from validated route params/query —
 * never trusted from a client-supplied body.
 */
export interface PermissionScope {
  readonly teamId?: string;
  readonly seasonId?: string;
}

/**
 * Application-owned contract for resolving a principal's effective permissions
 * within a scope. The guard depends on this port, never on the persistence
 * engine. Implementations union the account-role baseline with the principal's
 * active, in-effect, scoped database role assignments, and cache with explicit
 * invalidation. Returns the set of granted permission keys (as strings).
 */
export interface EffectivePermissionResolverPort {
  resolve(
    principal: AuthUserIdentity,
    scope: PermissionScope,
  ): Promise<ReadonlySet<string>>;
}

export const EFFECTIVE_PERMISSION_RESOLVER_PORT = Symbol(
  'EFFECTIVE_PERMISSION_RESOLVER_PORT',
);
