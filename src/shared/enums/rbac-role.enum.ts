/**
 * Keys of the default, system-seeded role bundles. A role is a named, ordered
 * bundle of permissions (`@shared/constants/role-bundles.constants`), never an
 * authorization conditional. These keys are stored verbatim in the `roles`
 * table and referenced by `user_role_assignments`. Additional, tenant-defined
 * bundles may exist in the database; these are the guaranteed system defaults.
 */
export enum RbacRole {
  Member = 'MEMBER',
  Coach = 'COACH',
  TeamAdmin = 'TEAM_ADMIN',
  Scorekeeper = 'SCOREKEEPER',
  Analyst = 'ANALYST',
}

export const RBAC_ROLE_VALUES: readonly RbacRole[] = Object.values(RbacRole);
