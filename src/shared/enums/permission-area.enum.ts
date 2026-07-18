/**
 * Grouping areas for the permission catalog. Each canonical permission belongs
 * to exactly one area; areas mirror the bounded contexts in
 * `11-SCHEMAS/rbac.permissions.yaml` and drive catalog navigation and docs.
 */
export enum PermissionArea {
  Team = 'team',
  Members = 'members',
  Practices = 'practices',
  Performance = 'performance',
  Training = 'training',
  Competition = 'competition',
  Match = 'match',
  Tryouts = 'tryouts',
  Governance = 'governance',
  Operations = 'operations',
}

export const PERMISSION_AREA_VALUES: readonly PermissionArea[] =
  Object.values(PermissionArea);
