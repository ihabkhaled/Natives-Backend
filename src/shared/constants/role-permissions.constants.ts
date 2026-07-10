import { Permission, Role } from '@shared/enums';

export const ARTICLE_PERMISSIONS: readonly Permission[] = [
  Permission.ArticleCreate,
  Permission.ArticleRead,
];

export const ROLE_PERMISSIONS: ReadonlyMap<Role, readonly Permission[]> =
  new Map([
    [Role.Admin, ARTICLE_PERMISSIONS],
    [Role.User, ARTICLE_PERMISSIONS],
  ]);
