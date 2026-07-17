export enum Permission {
  ArticleCreate = 'article:create',
  ArticleRead = 'article:read',
}

export const PERMISSION_VALUES: readonly Permission[] =
  Object.values(Permission);
