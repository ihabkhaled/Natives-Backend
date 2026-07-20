import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Routes & OpenAPI tags ---------------------------------------------------
export const RBAC_ROUTE = 'rbac';
export const RBAC_API_TAG = 'rbac';
export const RBAC_ASSIGNMENTS_ROUTE = 'assignments';
export const RBAC_ASSIGNMENT_BY_ID_ROUTE = 'assignments/:assignmentId';
export const RBAC_USER_ASSIGNMENTS_ROUTE = 'users/:userId/assignments';
export const RBAC_ME_PERMISSIONS_ROUTE = 'me/permissions';
export const RBAC_ASSIGNMENT_ID_PARAM = 'assignmentId';
export const RBAC_USER_ID_PARAM = 'userId';

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

// --- Bounded read limits -----------------------------------------------------
// The seeded catalog is five bundles over ~90 permissions. The bound keeps the
// flattened catalog read explicitly capped rather than trusting table size.
export const RBAC_ROLE_CATALOG_MAX = 5000;
