import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { PlatformLifecycleSchema1723800000000 } from './1723800000000-platform-lifecycle-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

function statementsOf(queryRunner: ReturnType<typeof runner>): string {
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('PlatformLifecycleSchema1723800000000', () => {
  it('seeds the three platform permissions and the SUPER_ADMIN bundle', async () => {
    const queryRunner = runner();

    await new PlatformLifecycleSchema1723800000000().up(
      queryRunner as never as QueryRunner,
    );

    const parameters = queryRunner.query.mock.calls.flatMap(call =>
      Array.isArray(call[1]) ? (call[1] as unknown[]) : [],
    );
    expect(parameters).toContain('platform.admin');
    expect(parameters).toContain('team.create');
    expect(parameters).toContain('team.browse.all');
    expect(parameters).toContain('SUPER_ADMIN');

    const statements = statementsOf(queryRunner);
    expect(statements).toContain('INSERT INTO "permissions"');
    expect(statements).toContain('ON CONFLICT ("key") DO NOTHING');
    expect(statements).toContain('CROSS JOIN "permissions" p');
  });

  it('adds the team lifecycle column, state check and status index', async () => {
    const queryRunner = runner();

    await new PlatformLifecycleSchema1723800000000().up(
      queryRunner as never as QueryRunner,
    );

    const statements = statementsOf(queryRunner);
    expect(statements).toContain(
      'ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz',
    );
    expect(statements).toContain(
      `CHECK ("status" IN ('active', 'disabled', 'archived'))`,
    );
    expect(statements).toContain('CREATE INDEX "ix_teams_status"');
  });

  it('normalises duplicate active seasons before enforcing one per team', async () => {
    const queryRunner = runner();

    await new PlatformLifecycleSchema1723800000000().up(
      queryRunner as never as QueryRunner,
    );

    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    const normaliseIndex = statements.findIndex(statement =>
      statement.includes(`UPDATE "seasons" SET "status" = 'closed'`),
    );
    const uniqueIndex = statements.findIndex(statement =>
      statement.includes('ux_seasons_one_active_per_team'),
    );

    expect(normaliseIndex).toBeGreaterThanOrEqual(0);
    expect(uniqueIndex).toBeGreaterThan(normaliseIndex);
    expect(statements[normaliseIndex]).toContain('DISTINCT ON ("team_id")');
    expect(statements[uniqueIndex]).toContain(`WHERE "status" = 'active'`);
  });

  it('reverses every object it created without discarding granted authority', async () => {
    const queryRunner = runner();

    await new PlatformLifecycleSchema1723800000000().down(
      queryRunner as never as QueryRunner,
    );

    const statements = statementsOf(queryRunner);
    expect(statements).toContain(
      'DROP INDEX IF EXISTS "ux_seasons_one_active_per_team"',
    );
    expect(statements).toContain(
      'DROP INDEX IF EXISTS "ix_seasons_team_current"',
    );
    expect(statements).toContain(
      'ALTER TABLE "seasons" DROP CONSTRAINT IF EXISTS "ck_seasons_status"',
    );
    expect(statements).toContain('DROP INDEX IF EXISTS "ix_teams_status"');
    expect(statements).toContain(
      'ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "ck_teams_status"',
    );
    expect(statements).toContain(
      'ALTER TABLE "teams" DROP COLUMN IF EXISTS "deleted_at"',
    );
    expect(statements).toContain('FROM "user_role_assignments" a');
    expect(statements).toContain('FROM "role_permissions" rp');
  });
});
