import { describe, expect, it, vi } from 'vitest';

import { SEED_ADMIN_KEY } from './seed.constants';
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
  };
}

describe('buildSeeders', () => {
  it('registers the admin seeder', () => {
    const seeders = buildSeeders(buildContext());

    expect(seeders).toHaveLength(1);
    expect(seeders[0]?.key).toBe(SEED_ADMIN_KEY);
  });

  it('does not resolve the runtime admin config until a seeder runs', () => {
    const context = buildContext();

    buildSeeders(context);

    expect(context.loadAdminConfig).not.toHaveBeenCalled();
  });
});
