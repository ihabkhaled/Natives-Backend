import type { EmailProvider, LogLevel, NodeEnv } from '@shared/enums';

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
  readonly migrationsRunOnStart: boolean;
  readonly seedOnStart: boolean;
}

export interface IdentityConfig {
  readonly refreshTokenTtlSeconds: number;
  readonly invitationTtlSeconds: number;
  readonly passwordResetTtlSeconds: number;
  readonly maxFailedLoginAttempts: number;
  readonly failedLoginWindowSeconds: number;
  readonly accountLockoutSeconds: number;
}

/**
 * Outbound email. `provider` selects which adapter the `EmailSenderPort` token
 * resolves to; `webBaseUrl` is the origin recipient-facing links are built
 * against. Swapping to a real transport is a change to these values plus one
 * new adapter — no use case changes.
 */
export interface EmailConfig {
  readonly provider: EmailProvider;
  readonly fromAddress: string;
  readonly webBaseUrl: string;
}

/**
 * Background-job scheduling. `enabled=false` keeps every registered job
 * dormant (the health endpoint then reports them degraded/never-ran — the
 * honest state); tests force it off so suites never race the scheduler.
 */
export interface JobsConfig {
  readonly enabled: boolean;
}

export interface SeedAdminConfig {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

/**
 * Runtime-only credential for the demonstration-persona seed. One shared
 * password provisions the whole persona cast; it is resolved lazily and only on
 * a fresh database, never logged, and never part of a seeder checksum.
 */
export interface SeedPersonasConfig {
  readonly password: string;
}

export interface RootConfig {
  readonly app: AppConfig;
  readonly security: SecurityConfig;
  readonly database: DatabaseConfig;
  readonly identity: IdentityConfig;
  readonly email: EmailConfig;
  readonly jobs: JobsConfig;
}
