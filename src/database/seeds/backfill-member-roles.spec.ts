import type { QueryRunner } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runMemberRoleBackfill } from './backfill-member-roles';
import { BACKFILL_ROLE_MISSING_MESSAGE } from './backfill-member-roles.constants';

const CANDIDATE_ROWS = [
  { membership_id: 'mem-1', user_id: 'user-1', team_id: 'team-1' },
  { membership_id: 'mem-2', user_id: 'user-2', team_id: 'team-2' },
];

function runner() {
  return { query: vi.fn().mockResolvedValue([]) };
}

describe('runMemberRoleBackfill', () => {
  let queryRunner: ReturnType<typeof runner>;

  beforeEach(() => {
    queryRunner = runner();
  });

  it('selects only active linked memberships with zero live assignments', async () => {
    queryRunner.query.mockResolvedValueOnce(CANDIDATE_ROWS);

    const result = await runMemberRoleBackfill(
      queryRunner as never as QueryRunner,
      false,
    );

    const sql = String(queryRunner.query.mock.calls[0]?.[0]);
    expect(sql).toContain(`"user_id" IS NOT NULL AND m."status" = 'active'`);
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('"revoked_at" IS NULL');
    expect(result.candidates).toEqual([
      { membershipId: 'mem-1', userId: 'user-1', teamId: 'team-1' },
      { membershipId: 'mem-2', userId: 'user-2', teamId: 'team-2' },
    ]);
  });

  it('dry run reports the plan and mutates nothing', async () => {
    queryRunner.query.mockResolvedValueOnce(CANDIDATE_ROWS);

    const result = await runMemberRoleBackfill(
      queryRunner as never as QueryRunner,
      false,
    );

    expect(result.applied).toBe(false);
    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  it('apply grants exactly the listed set with NULL provenance plus audit, then bumps once', async () => {
    queryRunner.query
      .mockResolvedValueOnce(CANDIDATE_ROWS)
      .mockResolvedValueOnce([{ id: 'role-member' }])
      .mockResolvedValue([]);

    const result = await runMemberRoleBackfill(
      queryRunner as never as QueryRunner,
      true,
    );

    expect(result.applied).toBe(true);
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    const inserts = statements.filter(sql =>
      sql.includes('INSERT INTO "user_role_assignments"'),
    );
    const audits = statements.filter(sql =>
      sql.includes('INSERT INTO "security_events"'),
    );
    const bumps = statements.filter(sql =>
      sql.includes('UPDATE "rbac_policy_version"'),
    );
    expect(inserts).toHaveLength(2);
    expect(audits).toHaveLength(2);
    expect(bumps).toHaveLength(1);
    expect(inserts[0]).toContain('NULL, NULL');

    const assignmentParams = queryRunner.query.mock.calls[2]?.[1] as unknown[];
    expect(assignmentParams[1]).toBe('user-1');
    expect(assignmentParams[2]).toBe('role-member');
    expect(assignmentParams[3]).toBe('team-1');

    const auditParams = queryRunner.query.mock.calls[3]?.[1] as unknown[];
    expect(String(auditParams[2])).toContain('"backfill":true');
    expect(String(auditParams[2])).toContain('"roleKey":"MEMBER"');
  });

  it('apply with an empty plan writes nothing at all', async () => {
    queryRunner.query.mockResolvedValueOnce([]);

    const result = await runMemberRoleBackfill(
      queryRunner as never as QueryRunner,
      true,
    );

    expect(result).toEqual({ candidates: [], applied: false });
    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  it('fails fast when the MEMBER role has not been migrated', async () => {
    queryRunner.query
      .mockResolvedValueOnce(CANDIDATE_ROWS)
      .mockResolvedValueOnce([]);

    await expect(
      runMemberRoleBackfill(queryRunner as never as QueryRunner, true),
    ).rejects.toThrow(BACKFILL_ROLE_MISSING_MESSAGE);
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements.some(sql => sql.includes('INSERT INTO'))).toBe(false);
  });
});
