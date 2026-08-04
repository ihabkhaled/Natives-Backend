import type { QueryRunner } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runInvitedMembershipReconciliation } from './reconcile-invited-memberships';
import { RECONCILE_ROLE_MISSING_PREFIX } from './reconcile-invited-memberships.constants';

const PENDING_ROW = {
  invitation_id: 'inv-pending',
  email: 'recruit@example.com',
  team_id: 'team-1',
  team_role_key: 'MEMBER',
  status: 'pending',
  membership_id: 'mem-1',
  candidate_count: 1,
  invitation_count: 1,
  user_id: null,
};

const ACCEPTED_ROW = {
  invitation_id: 'inv-accepted',
  email: 'stranded@example.com',
  team_id: 'team-2',
  team_role_key: 'COACH',
  status: 'accepted',
  membership_id: 'mem-2',
  candidate_count: 1,
  invitation_count: 1,
  user_id: 'user-2',
};

const AMBIGUOUS_ROW = {
  invitation_id: 'inv-ambiguous',
  email: 'unclear@example.com',
  team_id: 'team-3',
  team_role_key: 'MEMBER',
  status: 'accepted',
  membership_id: 'mem-3',
  candidate_count: 4,
  invitation_count: 1,
  user_id: 'user-3',
};

function runner() {
  return { query: vi.fn().mockResolvedValue([]) };
}

/**
 * Answer by statement rather than by call order: the repair runs a different
 * number of writes per orphan, so an ordinal mock would break every time a
 * single audit row moved.
 */
function answering(
  queryRunner: ReturnType<typeof runner>,
  orphans: readonly unknown[],
  roles: readonly { id: string }[],
): void {
  queryRunner.query.mockImplementation((sql: string) => {
    if (sql.includes('WITH "candidates"')) {
      return Promise.resolve(orphans);
    }
    if (sql.includes('FROM "roles"')) {
      return Promise.resolve(roles);
    }
    // The guarded link UPDATE returns the row it took; the grant depends on it.
    if (sql.includes('UPDATE "memberships"')) {
      return Promise.resolve([{ id: 'mem-linked' }]);
    }
    return Promise.resolve([]);
  });
}

function statements(queryRunner: ReturnType<typeof runner>): string[] {
  return queryRunner.query.mock.calls.map(call => String(call[0]));
}

describe('runInvitedMembershipReconciliation', () => {
  let queryRunner: ReturnType<typeof runner>;

  beforeEach(() => {
    queryRunner = runner();
  });

  it('finds team invitations no membership carries the email of', async () => {
    queryRunner.query.mockResolvedValueOnce([PENDING_ROW]);

    const result = await runInvitedMembershipReconciliation(
      queryRunner as never as QueryRunner,
      false,
    );

    const sql = statements(queryRunner)[0] ?? '';
    expect(sql).toContain(`"team_id" IS NOT NULL`);
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain(`lower(p."email") = lower(i."email")`);
    expect(result.orphans[0]?.verdict).toBe('repairable');
  });

  it('dry run reports the plan and mutates nothing', async () => {
    queryRunner.query.mockResolvedValueOnce([PENDING_ROW, ACCEPTED_ROW]);

    const result = await runInvitedMembershipReconciliation(
      queryRunner as never as QueryRunner,
      false,
    );

    expect(result.applied).toBe(false);
    expect(result.repaired).toEqual([]);
    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  /**
   * A pending invitation is not spent, so the ordinary accept path can still
   * do the privileged work. Reconciliation restores only the address and stops
   * — it must not pre-activate a membership or grant a role to an account that
   * does not exist yet.
   */
  it('repairs a pending invitation by restoring the address alone', async () => {
    queryRunner.query.mockResolvedValueOnce([PENDING_ROW]);

    const result = await runInvitedMembershipReconciliation(
      queryRunner as never as QueryRunner,
      true,
    );

    const sql = statements(queryRunner);
    expect(sql.some(text => text.includes('UPDATE "member_profiles"'))).toBe(
      true,
    );
    expect(sql.some(text => text.includes('UPDATE "memberships"'))).toBe(false);
    expect(
      sql.some(text => text.includes('INSERT INTO "user_role_assignments"')),
    ).toBe(false);
    expect(result.repaired).toHaveLength(1);
  });

  /**
   * An accepted invitation's token is spent and cannot be replayed, so the
   * membership is linked and the role the invitation already promised is
   * granted — the role key comes from the invitation, ceiling-validated when
   * it was issued.
   */
  it('links and grants for an accepted invitation, with history and audit', async () => {
    answering(queryRunner, [ACCEPTED_ROW], [{ id: 'role-coach' }]);

    const result = await runInvitedMembershipReconciliation(
      queryRunner as never as QueryRunner,
      true,
    );

    const sql = statements(queryRunner);
    expect(sql.some(text => text.includes('UPDATE "memberships"'))).toBe(true);
    expect(
      sql.some(text => text.includes('INSERT INTO "membership_status_events"')),
    ).toBe(true);
    expect(
      sql.some(text => text.includes('INSERT INTO "user_role_assignments"')),
    ).toBe(true);
    expect(sql.some(text => text.includes('"rbac_policy_version"'))).toBe(true);
    expect(result.applied).toBe(true);
  });

  /**
   * The one thing reconciliation infers is which membership belongs to an
   * invitation. With more than one email-less candidate in the team, guessing
   * would attach a person to a stranger's roster record.
   */
  it('leaves an ambiguous team untouched and reports it instead', async () => {
    queryRunner.query.mockResolvedValueOnce([AMBIGUOUS_ROW]);

    const result = await runInvitedMembershipReconciliation(
      queryRunner as never as QueryRunner,
      true,
    );

    expect(result.orphans[0]?.verdict).toBe('ambiguous');
    expect(result.orphans[0]?.membershipId).toBeNull();
    expect(result.repaired).toEqual([]);
    expect(result.applied).toBe(false);
    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  /**
   * Two orphaned invitations over one candidate membership is the shape that
   * could grant a role to somebody holding no membership: both name the same
   * row, the first repair takes it, and the second is left with an invitation
   * and nothing to link. Neither is repaired.
   */
  it('refuses a team where two invitations compete for one membership', async () => {
    answering(
      queryRunner,
      [
        { ...ACCEPTED_ROW, invitation_count: 2 },
        {
          ...ACCEPTED_ROW,
          invitation_id: 'inv-accepted-2',
          invitation_count: 2,
        },
      ],
      [{ id: 'role-coach' }],
    );

    const result = await runInvitedMembershipReconciliation(
      queryRunner as never as QueryRunner,
      true,
    );

    expect(result.orphans.every(orphan => orphan.verdict === 'ambiguous')).toBe(
      true,
    );
    expect(result.repaired).toEqual([]);
    expect(
      statements(queryRunner).some(text =>
        text.includes('INSERT INTO "user_role_assignments"'),
      ),
    ).toBe(false);
  });

  /**
   * The last line of defence. If the membership was taken between the scan and
   * the write, the UPDATE matches nothing — and the role grant must not happen
   * anyway, because a role assignment for somebody with no membership in the
   * team is a permission with nothing behind it.
   */
  it('does not grant a role when the membership was already claimed', async () => {
    queryRunner.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH "candidates"')) {
        return Promise.resolve([ACCEPTED_ROW]);
      }
      if (sql.includes('FROM "roles"')) {
        return Promise.resolve([{ id: 'role-coach' }]);
      }
      // The guarded UPDATE returns no row: somebody else took the membership.
      return Promise.resolve([]);
    });

    await runInvitedMembershipReconciliation(
      queryRunner as never as QueryRunner,
      true,
    );

    const sql = statements(queryRunner);
    expect(sql.some(text => text.includes('UPDATE "memberships"'))).toBe(true);
    expect(
      sql.some(text => text.includes('INSERT INTO "user_role_assignments"')),
    ).toBe(false);
    expect(
      sql.some(text => text.includes('INSERT INTO "membership_status_events"')),
    ).toBe(false);
  });

  it('refuses to invent a role that the catalog no longer holds', async () => {
    answering(queryRunner, [ACCEPTED_ROW], []);

    await expect(
      runInvitedMembershipReconciliation(
        queryRunner as never as QueryRunner,
        true,
      ),
    ).rejects.toThrow(RECONCILE_ROLE_MISSING_PREFIX);
  });
});
