import type { Role } from '@shared/enums';

export interface AuthUserIdentity {
  readonly userId: string;
  readonly email: string;
  readonly roles: readonly Role[];
}

export interface AuthHeaders {
  readonly authorization?: string;
}

export interface AuthRequest {
  readonly headers: AuthHeaders;
  user?: AuthUserIdentity;
}

export interface AuthenticatedRequest extends AuthRequest {
  user: AuthUserIdentity;
}

export interface AuthTokenPort {
  sign(identity: AuthUserIdentity): Promise<string>;
  verify(token: string): AuthUserIdentity | null;
}
