/**
 * Whether a permission grant adds (allow) or removes (deny) a permission during
 * effective-permission resolution. Deny wins over allow within the same scope.
 * The database currently produces only `Allow` grants (from role assignments);
 * `Deny` supports the deferred per-user override table and keeps the pure
 * resolution algorithm complete and unit-testable.
 */
export enum GrantEffect {
  Allow = 'allow',
  Deny = 'deny',
}

export const GRANT_EFFECT_VALUES: readonly GrantEffect[] =
  Object.values(GrantEffect);
