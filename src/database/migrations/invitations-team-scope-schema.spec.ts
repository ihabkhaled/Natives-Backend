import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { InvitationsTeamScope1724800000000 } from './1724800000000-invitations-team-scope';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('InvitationsTeamScope1724800000000', () => {
  it('adds a nullable team scope column and a partial index', async () => {
    const queryRunner = runner();
    await new InvitationsTeamScope1724800000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain(
      'ALTER TABLE "invitations" ADD COLUMN "team_id" uuid',
    );
    expect(statements).toContain('"ix_invitations_team"');
    expect(statements).toContain('WHERE "team_id" IS NOT NULL');
    expect(statements).not.toContain('NOT NULL,');
    expect(statements).not.toContain('REFERENCES');
  });

  it('reverses exactly what it created', async () => {
    const queryRunner = runner();
    await new InvitationsTeamScope1724800000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements[0]).toContain(
      'DROP INDEX IF EXISTS "ix_invitations_team"',
    );
    expect(statements[1]).toContain(
      'ALTER TABLE "invitations" DROP COLUMN IF EXISTS "team_id"',
    );
  });
});
