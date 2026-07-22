import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Routes & OpenAPI tags ---------------------------------------------------
export const RBAC_ROUTE = 'rbac';
export const RBAC_API_TAG = 'rbac';
export const RBAC_ASSIGNMENTS_ROUTE = 'assignments';
export const RBAC_ASSIGNMENT_BY_ID_ROUTE = 'assignments/:assignmentId';
export const RBAC_USER_ASSIGNMENTS_ROUTE = 'users/:userId/assignments';
export const RBAC_ME_PERMISSIONS_ROUTE = 'me/permissions';
export const RBAC_ROLE_BUNDLES_ROUTE = 'role-bundles';
// The `:teamId` path param gives the permission guard a team scope, so a team
// admin resolves the assignable catalog in their own team only.
export const RBAC_ASSIGNABLE_ROLES_ROUTE = 'teams/:teamId/assignable-roles';
export const RBAC_ASSIGNMENT_ID_PARAM = 'assignmentId';
export const RBAC_USER_ID_PARAM = 'userId';
export const RBAC_TEAM_ID_PARAM = 'teamId';

// Platform super-admin management. No `:teamId` anywhere on these routes, so
// the request scope resolves globally and `platform.admin` is only ever
// satisfied by a global (teamId IS NULL) grant — an existing super admin.
export const RBAC_PLATFORM_ADMINS_ROUTE = 'rbac/platform/super-admins';
export const RBAC_PLATFORM_ADMIN_BY_USER_ROUTE = ':userId';
export const RBAC_PLATFORM_ADMINS_API_TAG = 'platform-admins';

// --- Role slug vocabulary ----------------------------------------------------
// RBAC owns the role vocabulary. Other modules validate only the SHAPE of a
// client-supplied role slug against these; resolution happens here against the
// open database catalog, never a compiled enum.
export const ROLE_SLUG_PATTERN = /^[a-z][a-z0-9_]*$/u;
export const ROLE_SLUG_MAX_LENGTH = 64;

// --- Lifecycle ---------------------------------------------------------------
// The single user status that may exercise permission-gated routes. A principal
// whose account is not active (invited/inactive/suspended/left/deleted) resolves
// to zero permissions, denying every protected operation.
export const RBAC_ACTIVE_USER_STATUS = 'active';

// --- Logs --------------------------------------------------------------------
export const RBAC_SCOPED_RESOLUTION_FAILED_LOG =
  'Scoped permission resolution unavailable; falling back to account-role baseline';

// --- Audit event types -------------------------------------------------------
export const RBAC_ROLE_ASSIGNED_EVENT = 'rbac.roleAssigned';
export const RBAC_ROLE_REVOKED_EVENT = 'rbac.roleRevoked';
export const RBAC_SUPER_ADMIN_PROMOTED_EVENT = 'rbac.superAdminPromoted';
export const RBAC_SUPER_ADMIN_REVOKED_EVENT = 'rbac.superAdminRevoked';

// --- Role catalog metadata ---------------------------------------------------
export const RBAC_TEAM_ROLE_SCOPE = 'team';
export const RBAC_PLATFORM_ROLE_SCOPE = 'platform';

// --- Super-admin promotion bounds --------------------------------------------
// The audited reason is the P1 compensating control for the deferred step-up
// re-authentication: mandatory, human-meaningful, and bounded.
export const RBAC_REASON_MIN_LENGTH = 8;
export const RBAC_REASON_MAX_LENGTH = 500;
export const RBAC_SUPER_ADMIN_LIST_MAX = 200;

// --- Error messages & keys ---------------------------------------------------
export const RBAC_ROLE_NOT_FOUND_MESSAGE = 'The role was not found';
export const RBAC_ROLE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.rbac.roleNotFound';

export const RBAC_ASSIGNMENT_NOT_FOUND_MESSAGE =
  'The role assignment was not found';
export const RBAC_ASSIGNMENT_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.rbac.assignmentNotFound';

export const RBAC_ESCALATION_DENIED_MESSAGE =
  'Cannot grant permissions beyond your own within this scope';
export const RBAC_ESCALATION_DENIED_MESSAGE_KEY: ErrorMessageKey =
  'errors.rbac.escalationDenied';

export const RBAC_PROTECTED_ROLE_MESSAGE =
  'This role cannot be assigned through a team-scoped flow';
export const RBAC_PROTECTED_ROLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.rbac.protectedRole';

export const RBAC_LAST_SUPER_ADMIN_MESSAGE =
  'The last super administrator cannot be removed';
export const RBAC_LAST_SUPER_ADMIN_MESSAGE_KEY: ErrorMessageKey =
  'errors.rbac.lastSuperAdmin';

export const RBAC_USER_NOT_ELIGIBLE_MESSAGE =
  'The target user does not exist or is not active';
export const RBAC_USER_NOT_ELIGIBLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.rbac.userNotEligible';

// --- Bounded read limits -----------------------------------------------------
// The seeded catalog is five bundles over ~90 permissions. The bound keeps the
// flattened catalog read explicitly capped rather than trusting table size.
export const RBAC_ROLE_CATALOG_MAX = 5000;

// Bounds for the role x permission matrix read. The seeded catalog is 91
// permissions over 6 bundles; both reads stay explicitly capped rather than
// trusting table size, and both are ordered deterministically.
export const RBAC_PERMISSION_CATALOG_MAX = 1000;
export const RBAC_ROLE_DEFINITION_MAX = 200;
