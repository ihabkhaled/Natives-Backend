import type { GrantEffect } from './rbac.enums';

// --- Resolution inputs -------------------------------------------------------

/**
 * A single scoped, time-bounded permission grant fed into the pure resolution
 * algorithm. Role assignments expand into one grant per bundled permission
 * (effect Allow); the deferred override table would contribute Deny grants.
 */
export interface PermissionGrant {
  readonly permission: string;
  readonly effect: GrantEffect;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
}

// --- Aggregates --------------------------------------------------------------

export interface RbacRoleRecord {
  readonly id: string;
  readonly key: string;
}

export interface RoleAssignment {
  readonly id: string;
  readonly userId: string;
  readonly roleId: string;
  readonly roleKey: string;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly grantedBy: string | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
  readonly version: number;
}

// --- Persistence write models ------------------------------------------------

export interface NewRoleAssignment {
  readonly id: string;
  readonly userId: string;
  readonly roleId: string;
  readonly roleKey: string;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly grantedBy: string | null;
}

export interface NewRbacAuditEvent {
  readonly id: string;
  readonly eventType: string;
  readonly actorUserId: string | null;
  readonly context: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt: Date;
}

// --- Application command / result models -------------------------------------

export interface AssignRoleCommand {
  readonly userId: string;
  readonly roleKey: string;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  /** ISO-8601 instant the assignment stops being effective, or null for open-ended. */
  readonly effectiveTo: string | null;
}

/** Cached raw grants for a user, keyed against the policy version they were loaded under. */
export interface ResolverCacheEntry {
  readonly version: number;
  readonly grants: readonly PermissionGrant[];
}

export interface UserAssignmentsView {
  readonly userId: string;
  readonly assignments: readonly RoleAssignment[];
}

export interface EffectivePermissionsView {
  readonly userId: string;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly permissions: readonly string[];
}

/** One role of the catalog with the permission keys its bundle grants. */
export interface RoleBundleRecord {
  readonly roleKey: string;
  readonly permissions: readonly string[];
}

/** The roles a membership holds in a team plus the roles the actor may set. */
export interface TeamRolesView {
  readonly roles: readonly string[];
  readonly assignableRoles: readonly string[];
}

/** Replace-the-set command for a user's team-scoped role assignments. */
export interface ReplaceTeamRolesCommand {
  readonly userId: string;
  readonly teamId: string;
  readonly roleKeys: readonly string[];
}

/** The grants to add and the assignments to revoke to reach a requested set. */
export interface RoleSetDiff {
  readonly toGrant: readonly string[];
  readonly toRevoke: readonly RoleAssignment[];
}
