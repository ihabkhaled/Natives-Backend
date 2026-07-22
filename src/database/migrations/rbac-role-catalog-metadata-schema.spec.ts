import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { RbacRoleCatalogMetadata1725000000000 } from './1725000000000-rbac-role-catalog-metadata';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('RbacRoleCatalogMetadata1725000000000', () => {
  it('adds scope and assignability columns with safe team defaults', async () => {
    const queryRunner = runner();
    await new RbacRoleCatalogMetadata1725000000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain(
      `ADD COLUMN "scope" text NOT NULL DEFAULT 'team'`,
    );
    expect(statements).toContain(`CHECK ("scope" IN ('team','platform'))`);
    expect(statements).toContain(
      `ADD COLUMN "is_assignable" boolean NOT NULL DEFAULT true`,
    );
  });

  it('stamps SUPER_ADMIN platform-scoped and unassignable', async () => {
    const queryRunner = runner();
    await new RbacRoleCatalogMetadata1725000000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain(
      `SET "scope" = 'platform', "is_assignable" = false`,
    );
    expect(statements).toContain(`WHERE "key" = 'SUPER_ADMIN'`);
  });

  it('reverses exactly what it created', async () => {
    const queryRunner = runner();
    await new RbacRoleCatalogMetadata1725000000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements[0]).toContain(
      'ALTER TABLE "roles" DROP COLUMN IF EXISTS "is_assignable"',
    );
    expect(statements[1]).toContain(
      'ALTER TABLE "roles" DROP COLUMN IF EXISTS "scope"',
    );
  });
});
