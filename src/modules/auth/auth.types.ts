export interface AuthUserIdentity {
  readonly userId: string;
  readonly email: string;
  readonly roles: readonly string[];
}

export interface AuthenticatedRequest {
  readonly user: AuthUserIdentity;
}
