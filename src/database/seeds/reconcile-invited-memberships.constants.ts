export const RECONCILE_APPLY_FLAG = '--apply';
export const RECONCILE_ROLE_MISSING_PREFIX = 'Role is missing for key';
export const RECONCILE_EMAIL_BACKFILL_EVENT = 'members.profileEmailBackfilled';
export const RECONCILE_LINK_EVENT = 'members.accountLinked';
export const RECONCILE_ROLE_EVENT = 'rbac.roleAssigned';
export const RECONCILE_DRY_RUN_HEADER =
  'Dry run — invitations whose roster membership carries no email (pass --apply to repair):';
export const RECONCILE_APPLY_HEADER = 'Repairing orphaned invitations:';
export const RECONCILE_NOTHING_TO_DO_MESSAGE =
  'Nothing to reconcile: every team invitation has a membership carrying its email.';
export const RECONCILE_AMBIGUOUS_NOTE =
  'Left alone — more than one invited membership in this team has no email; link it by hand.';
export const RECONCILE_FAILED_PREFIX =
  'Invited-membership reconciliation failed';
