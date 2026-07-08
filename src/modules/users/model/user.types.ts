export interface User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly roles: readonly string[];
}

export interface UserCredentials {
  readonly email: string;
  readonly password: string;
}
