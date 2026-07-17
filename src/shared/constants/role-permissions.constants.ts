import { Permission, Role } from '@shared/enums';

export const ARTICLE_PERMISSIONS: readonly Permission[] = [
  Permission.ArticleCreate,
  Permission.ArticleRead,
];

export const INVITATION_PERMISSIONS: readonly Permission[] = [
  Permission.InvitationCreate,
  Permission.InvitationRead,
  Permission.InvitationRevoke,
];

export const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...ARTICLE_PERMISSIONS,
  ...INVITATION_PERMISSIONS,
];

export const ROLE_PERMISSIONS: ReadonlyMap<Role, readonly Permission[]> =
  new Map([
    [Role.Admin, ADMIN_PERMISSIONS],
    [Role.User, ARTICLE_PERMISSIONS],
  ]);
