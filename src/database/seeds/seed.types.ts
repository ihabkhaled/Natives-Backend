import type { QueryRunner } from 'typeorm';

/**
 * The transactional scope handed to a seeder's `run`. Every statement the seeder
 * issues, plus the `seed_history` row the framework writes, share this single
 * query runner so a seeder and its history record commit or roll back together.
 */
export interface SeedScope {
  readonly queryRunner: QueryRunner;
}

/**
 * A single seeder. `key` is the stable identity recorded in `seed_history`;
 * `checksum` is a content-derived fingerprint of the seeder definition (never of
 * runtime inputs such as a password) used to detect post-application drift.
 */
export interface Seeder {
  readonly key: string;
  readonly checksum: string;
  run(scope: SeedScope): Promise<void>;
}

/** Inputs needed to build the seed registry at a composition root. */
export interface SeedContext {
  readonly passwordHash: SeedPasswordHashPort;
  readonly loadAdminConfig: () => SeedAdminRuntimeConfig;
  readonly loadPersonasConfig: () => SeedPersonasRuntimeConfig;
}

/** Runtime-only persona credential resolved lazily, only when the seed runs. */
export interface SeedPersonasRuntimeConfig {
  readonly password: string;
}

/** Minimal password-hashing surface the admin seeder depends on. */
export interface SeedPasswordHashPort {
  hash(password: string): Promise<string>;
}

/** Runtime-only administrator inputs resolved lazily, only when the seed runs. */
export interface SeedAdminRuntimeConfig {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

/** A previously recorded seed application, looked up by `seed_key`. */
export interface SeedHistoryRecord {
  readonly checksum: string;
}

/** Outcome of evaluating one seeder against `seed_history`. */
export type SeedApplication = 'applied' | 'skipped' | 'changed';

/** Result reported per seeder after a run. */
export interface SeedOutcome {
  readonly key: string;
  readonly application: SeedApplication;
}
