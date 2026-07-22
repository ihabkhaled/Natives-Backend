export const BACKFILL_APPLY_FLAG = '--apply';
export const BACKFILL_MEMBER_ROLE_KEY = 'MEMBER';
export const BACKFILL_AUDIT_EVENT_TYPE = 'rbac.roleAssigned';
export const BACKFILL_DRY_RUN_HEADER =
  'Dry run — memberships whose linked user holds no live role in the team (pass --apply to grant MEMBER):';
export const BACKFILL_APPLY_HEADER = 'Applying MEMBER grants:';
export const BACKFILL_NOTHING_TO_DO_MESSAGE =
  'Nothing to reconcile: every active linked membership already has a live role assignment.';
export const BACKFILL_ROLE_MISSING_MESSAGE =
  'Role "MEMBER" is missing. Run "npm run migration:run" before backfilling.';
export const BACKFILL_FAILED_PREFIX = 'Member-role backfill failed';
