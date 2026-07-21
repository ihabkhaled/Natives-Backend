import { describe, expect, it, vi } from 'vitest';

import {
  SEED_ADMIN_KEY,
  SEED_PERSONAS_KEY,
  SEED_TEAM_KEY,
} from './seed.constants';
import type { SeedContext } from './seed.types';
import { buildSeeders } from './seed-registry';

function buildContext(): SeedContext {
  return {
    passwordHash: { hash: vi.fn().mockResolvedValue('hash') },
    loadAdminConfig: vi.fn(() => ({
      email: 'admin@example.test',
      password: 'runtime-only-password',
      displayName: 'Admin',
    })),
    loadPersonasConfig: vi.fn(() => ({ password: 'persona-only-password' })),
  };
}

describe('buildSeeders', () => {
  it('registers admin, then team, then personas', () => {
    const seeders = buildSeeders(buildContext());

    expect(seeders.map(seeder => seeder.key)).toEqual([
      SEED_ADMIN_KEY,
      SEED_TEAM_KEY,
      SEED_PERSONAS_KEY,
    ]);
  });

  it('gives every seeder a distinct key and checksum', () => {
    const seeders = buildSeeders(buildContext());

    expect(new Set(seeders.map(seeder => seeder.key)).size).toBe(
      seeders.length,
    );
    expect(new Set(seeders.map(seeder => seeder.checksum)).size).toBe(
      seeders.length,
    );
  });

  it('does not resolve the runtime admin config until a seeder runs', () => {
    const context = buildContext();

    buildSeeders(context);

    expect(context.loadAdminConfig).not.toHaveBeenCalled();
    expect(context.loadPersonasConfig).not.toHaveBeenCalled();
  });
});
