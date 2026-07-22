import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { InvitationTeamRole1725100000000 } from './1725100000000-invitation-team-role';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('InvitationTeamRole1725100000000', () => {
  it('adds the team role column defaulting to the legacy MEMBER grant', async () => {
    const queryRunner = runner();
    await new InvitationTeamRole1725100000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain(
      `ADD COLUMN "team_role_key" text NOT NULL DEFAULT 'MEMBER'`,
    );
  });

  it('checks the role KEY shape, not the seeded enum (open catalog)', async () => {
    const queryRunner = runner();
    await new InvitationTeamRole1725100000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('"ck_invitations_team_role_key"');
    expect(statements).toContain(`~ '^[A-Z][A-Z0-9_]*$'`);
    expect(statements).not.toContain("IN ('MEMBER'");
  });

  it('reverses exactly what it created', async () => {
    const queryRunner = runner();
    await new InvitationTeamRole1725100000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements[0]).toContain(
      'DROP CONSTRAINT IF EXISTS "ck_invitations_team_role_key"',
    );
    expect(statements[1]).toContain('DROP COLUMN IF EXISTS "team_role_key"');
  });
});
