export enum Permission {
  ArticleCreate = 'article:create',
  ArticleRead = 'article:read',
  InvitationCreate = 'invitation:create',
  InvitationRead = 'invitation:read',
  InvitationRevoke = 'invitation:revoke',
}

export const PERMISSION_VALUES: readonly Permission[] =
  Object.values(Permission);
