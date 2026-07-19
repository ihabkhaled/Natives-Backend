import type { SeedContext, Seeder } from './seed.types';
import { createSeedAdminSeeder } from './seed-admin';

/**
 * The ordered seed registry. Every seeder the framework knows about is listed
 * here; the runner then applies only those absent from `seed_history`. Building
 * the registry at a composition root (bootstrap or CLI) keeps the database layer
 * free of any auth/module coupling — the caller supplies the password-hash port
 * and the lazy runtime-config loader through `SeedContext`.
 */
export function buildSeeders(context: SeedContext): readonly Seeder[] {
  return [createSeedAdminSeeder(context.passwordHash, context.loadAdminConfig)];
}
