import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamNotFoundError } from '../errors/team-not-found.error';
import type {
  PublicTeamProfile,
  StaffDirectoryEntry,
} from '../model/teams.types';
import { PublicTeamDirectoryService } from './public-team-directory.service';

const SCOPE = {} as never;

const PROFILE: PublicTeamProfile = {
  id: 'team-1',
  slug: 'ultimate-natives',
  name: 'Ultimate Natives',
  location: 'El Sheikh Zayed, Giza, Egypt',
  foundedOn: '2021-10-01',
  facebookUrl: 'https://www.facebook.com/ultimatenatives',
  instagramUrl: 'https://www.instagram.com/ultimatenatives',
  tiktokUrl: 'https://www.tiktok.com/@ultimate.natives',
};

const STAFF: readonly StaffDirectoryEntry[] = [
  {
    membershipId: 'membership-1',
    displayName: 'Sherif Ashraf',
    nickname: '3alamy',
    titles: ['Coach'],
    photoUrl: null,
  },
];

const COMPETITIONS = [
  {
    competitionId: 'competition-1',
    name: 'EUNC 2026',
    seasonName: 'Season 2026',
    competitionType: 'tournament',
    startsOn: null,
    endsOn: null,
  },
];

const PLAYERS_RESULT = {
  items: [
    {
      membershipId: 'membership-2',
      teamId: 'team-1',
      status: 'active',
      displayName: 'Player One',
      nickname: null,
      jerseyNumber: 7,
      positions: ['handler'],
      hasAvatar: false,
    },
  ],
  total: 1,
  limit: 200,
  offset: 0,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const teams = {
    findPublicProfileBySlug: vi.fn().mockResolvedValue(PROFILE),
    listPublicCompetitions: vi.fn().mockResolvedValue(COMPETITIONS),
  };
  const staff = { listPublicDirectory: vi.fn().mockResolvedValue(STAFF) };
  const members = {
    listActiveMembers: vi.fn().mockResolvedValue(PLAYERS_RESULT),
  };
  const service = new PublicTeamDirectoryService(
    unitOfWork as never,
    teams as never,
    staff as never,
    members as never,
  );
  return { service, teams, staff, members };
}

describe('PublicTeamDirectoryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('composes the team profile, staff directory, roster, and competitions', async () => {
    const result = await harness.service.getDirectory('ultimate-natives');

    expect(result.profile).toBe(PROFILE);
    expect(result.staff).toBe(STAFF);
    expect(result.players).toEqual([
      {
        membershipId: 'membership-2',
        displayName: 'Player One',
        nickname: null,
        jerseyNumber: 7,
        positions: ['handler'],
        photoUrl: null,
      },
    ]);
    expect(result.competitions).toBe(COMPETITIONS);
    expect(harness.members.listActiveMembers).toHaveBeenCalledWith('team-1', {
      limit: 200,
      offset: 0,
    });
  });

  it('raises not-found for an unknown slug', async () => {
    harness.teams.findPublicProfileBySlug.mockResolvedValue(null);
    await expect(
      harness.service.getDirectory('ghost-team'),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
    expect(harness.members.listActiveMembers).not.toHaveBeenCalled();
  });
});
