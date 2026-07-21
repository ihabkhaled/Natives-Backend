import type { SeedContext, Seeder } from './seed.types';
import { createSeedAdminSeeder } from './seed-admin';
import { createSeedPersonasSeeder } from './seed-personas';
import { createSeedTeamSeeder } from './seed-team';

/**
 * The ordered seed registry. Every seeder the framework knows about is listed
 * here; the runner then applies only those absent from `seed_history`. Building
 * the registry at a composition root (bootstrap or CLI) keeps the database layer
 * free of any auth/module coupling — the caller supplies the password-hash port
 * and the lazy runtime-config loader through `SeedContext`.
 *
 * Order matters: the team seeder links the administrator the admin seeder
 * provisions, so it is registered after it and receives only that seeder's
 * email — never the runtime password it has no business reading. The persona
 * seeder comes last: it links every demonstration account to the team the team
 * seeder creates, and reads its own credential, never the administrator's.
 */
export function buildSeeders(context: SeedContext): readonly Seeder[] {
  return [
    createSeedAdminSeeder(context.passwordHash, context.loadAdminConfig),
    createSeedTeamSeeder(() => context.loadAdminConfig().email),
    createSeedPersonasSeeder(context.passwordHash, context.loadPersonasConfig),
  ];
}
