import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { TeamAdminMatchScore1724900000000 } from './1724900000000-team-admin-match-score';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

function statementsOf(queryRunner: ReturnType<typeof runner>): string {
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('TeamAdminMatchScore1724900000000', () => {
  it('grants match.score to TEAM_ADMIN idempotently and bumps the policy version', async () => {
    const queryRunner = runner();
    await new TeamAdminMatchScore1724900000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = statementsOf(queryRunner);
    expect(statements).toContain('INSERT INTO "role_permissions"');
    expect(statements).toContain('ON CONFLICT DO NOTHING');
    expect(statements).toContain('UPDATE "rbac_policy_version"');
    const parameters = queryRunner.query.mock.calls[0]?.[1];
    expect(parameters).toEqual(['TEAM_ADMIN', 'match.score']);
  });

  it('removes exactly this grant on down and bumps the policy version', async () => {
    const queryRunner = runner();
    await new TeamAdminMatchScore1724900000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = statementsOf(queryRunner);
    expect(statements).toContain('DELETE FROM "role_permissions"');
    expect(statements).toContain('UPDATE "rbac_policy_version"');
    const parameters = queryRunner.query.mock.calls[0]?.[1];
    expect(parameters).toEqual(['TEAM_ADMIN', 'match.score']);
  });
});
