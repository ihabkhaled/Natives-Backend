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

export interface RootConfig {
  readonly app: AppConfig;
  readonly security: SecurityConfig;
}
