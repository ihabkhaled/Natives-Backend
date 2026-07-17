import type { Role } from '@shared/enums';

export interface AuthUserIdentity {
  readonly userId: string;
  readonly email: string;
  readonly roles: readonly Role[];
}

export interface AuthHeaders {
  readonly authorization?: string;
}

/** Route params/query, as exposed by the HTTP adapter (string-keyed). */
export type RouteValues = Readonly<Record<string, unknown>>;

export interface AuthRequest {
  readonly headers: AuthHeaders;
  readonly params?: RouteValues;
  readonly query?: RouteValues;
  user?: AuthUserIdentity;
}

export interface AuthenticatedRequest extends AuthRequest {
  user: AuthUserIdentity;
}

export interface AuthTokenPort {
  sign(identity: AuthUserIdentity): Promise<string>;
  verify(token: string): AuthUserIdentity | null;
}
