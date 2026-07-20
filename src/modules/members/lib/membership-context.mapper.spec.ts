import { describe, expect, it } from 'vitest';

import { MembershipStatus } from '../model/members.enums';
import type { MembershipContextRow } from '../model/members.rows';
import { toMembershipContext } from './membership-context.mapper';

const ROW: MembershipContextRow = {
  membership_id: 'membership-1',
  team_id: 'team-1',
  team_slug: 'ultimate-natives',
  team_name: 'Ultimate Natives',
  season_id: 'season-1',
  season_slug: '2026',
  season_name: 'Season 2026',
  status: 'active',
  joined_at: '2026-02-01T00:00:00.000Z',
};

describe('toMembershipContext', () => {
  it('maps the joined row into the principal-facing context', () => {
    expect(toMembershipContext(ROW)).toEqual({
      membershipId: 'membership-1',
      teamId: 'team-1',
      teamSlug: 'ultimate-natives',
      teamName: 'Ultimate Natives',
      seasonId: 'season-1',
      seasonSlug: '2026',
      seasonName: 'Season 2026',
      status: MembershipStatus.Active,
      joinedAt: new Date('2026-02-01T00:00:00.000Z'),
    });
  });

  it('keeps a team without a season null rather than inventing one', () => {
    const context = toMembershipContext({
      ...ROW,
      season_id: null,
      season_slug: null,
      season_name: null,
    });

    expect(context.seasonId).toBeNull();
    expect(context.seasonSlug).toBeNull();
    expect(context.seasonName).toBeNull();
  });

  it('keeps a never-joined membership null and carries its real status', () => {
    const context = toMembershipContext({
      ...ROW,
      status: 'suspended',
      joined_at: null,
    });

    expect(context.status).toBe(MembershipStatus.Suspended);
    expect(context.joinedAt).toBeNull();
  });
});
