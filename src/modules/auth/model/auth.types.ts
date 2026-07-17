export interface AuthCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AuthToken {
  readonly accessToken: string;
}

export interface PasswordHashPort {
  matches(plainPassword: string, passwordHash: string): Promise<boolean>;
}
