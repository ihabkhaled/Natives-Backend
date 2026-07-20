import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MEMBERSHIP_CONTEXT_MAX } from '../model/members.constants';
import { MembershipContextRepository } from './membership-context.repository';

const ASOF = new Date('2026-07-20T12:00:00.000Z');

describe('MembershipContextRepository', () => {
  let repository: MembershipContextRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new MembershipContextRepository();
    scope = { run: vi.fn().mockResolvedValue([]) };
  });

  it('binds the user, the as-of date, and the hard bound', async () => {
    await repository.listForUser(scope as never, 'user-1', ASOF);

    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'user-1',
      '2026-07-20',
      MEMBERSHIP_CONTEXT_MAX,
    ]);
  });

  it('excludes soft-deleted memberships and bounds the read', async () => {
    await repository.listForUser(scope as never, 'user-1', ASOF);

    const sql = String(scope.run.mock.calls[0]?.[0]);
    expect(sql).toContain('"m"."deleted_at" IS NULL');
    expect(sql).toContain('LIMIT $3');
    expect(sql).toContain('LEFT JOIN LATERAL');
  });

  it('maps the returned rows into membership contexts', async () => {
    scope.run.mockResolvedValue([
      {
        membership_id: 'membership-1',
        team_id: 'team-1',
        team_slug: 'natives',
        team_name: 'Natives',
        season_id: null,
        season_slug: null,
        season_name: null,
        status: 'active',
        joined_at: null,
      },
    ]);

    const contexts = await repository.listForUser(
      scope as never,
      'user-1',
      ASOF,
    );

    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.teamSlug).toBe('natives');
    expect(contexts[0]?.seasonId).toBeNull();
  });

  it('returns nothing for a user with no memberships', async () => {
    expect(
      await repository.listForUser(scope as never, 'user-1', ASOF),
    ).toEqual([]);
  });
});
