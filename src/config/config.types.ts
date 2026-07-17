import type { LogLevel, NodeEnv } from '@shared/enums';

export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly name: string;
  readonly globalPrefix: string;
  readonly swaggerEnabled: boolean;
  readonly logLevel: LogLevel;
}

export interface SecurityConfig {
  readonly corsOrigins: readonly string[];
  readonly rateLimitTtlMs: number;
  readonly rateLimitMax: number;
  readonly jwtSecret: string;
  readonly jwtExpiresInSeconds: number;
}

export interface DatabaseConfig {
  readonly url: string | undefined;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string | undefined;
  readonly name: string;
  readonly poolMin: number;
  readonly poolMax: number;
  readonly connectTimeoutMs: number;
  readonly statementTimeoutMs: number;
  readonly ssl: boolean;
  readonly logging: boolean;
}

export interface IdentityConfig {
  readonly refreshTokenTtlSeconds: number;
  readonly invitationTtlSeconds: number;
  readonly passwordResetTtlSeconds: number;
  readonly maxFailedLoginAttempts: number;
  readonly failedLoginWindowSeconds: number;
  readonly accountLockoutSeconds: number;
}

export interface RootConfig {
  readonly app: AppConfig;
  readonly security: SecurityConfig;
  readonly database: DatabaseConfig;
  readonly identity: IdentityConfig;
}
