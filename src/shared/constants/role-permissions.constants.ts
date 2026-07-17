import { ROLE_BUNDLES } from '@shared/constants/role-bundles.constants';
import { Permission, PERMISSION_VALUES, RbacRole, Role } from '@shared/enums';

/**
 * Account-role baseline: the permissions every authenticated principal holds
 * globally purely by virtue of their coarse account role (`users.role`, carried
 * in the JWT). This is the no-database, always-available floor of the effective
 * permission resolver. Fine-grained, team/season-scoped capabilities are granted
 * additively through database-backed `user_role_assignments` (see the rbac
 * module). Roles remain bundles of catalog permissions — never conditionals.
 *
 * - Admin: system administrator — the full catalog (still audited on every write).
 * - User: an ordinary member — the MEMBER bundle plus the template article perms.
 */
const MEMBER_BASELINE: readonly Permission[] =
  ROLE_BUNDLES.get(RbacRole.Member) ?? [];

const USER_PERMISSIONS: readonly Permission[] = [
  Permission.ArticleCreate,
  Permission.ArticleRead,
  ...MEMBER_BASELINE,
];

export const ROLE_PERMISSIONS: ReadonlyMap<Role, readonly Permission[]> =
  new Map([
    [Role.Admin, PERMISSION_VALUES],
    [Role.User, USER_PERMISSIONS],
  ]);
