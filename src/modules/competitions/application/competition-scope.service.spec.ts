import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompetitionScopeNotFoundError } from '../errors/competition-scope-not-found.error';
import { CompetitionScopeService } from './competition-scope.service';

const TX = {} as never;

function build() {
  const repository = {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    seasonExistsInTeam: vi.fn().mockResolvedValue(true),
    venueExistsInTeam: vi.fn().mockResolvedValue(true),
  };
  const service = new CompetitionScopeService(repository);
  return { repository, service };
}

describe('CompetitionScopeService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('passes when the team and season both exist', async () => {
    await expect(
      harness.service.validate(TX, 'team-1', 'season-1'),
    ).resolves.toBeUndefined();
  });

  it('404s when the team is missing or archived', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(false);
    await expect(
      harness.service.validate(TX, 'team-1', 'season-1'),
    ).rejects.toBeInstanceOf(CompetitionScopeNotFoundError);
    expect(harness.repository.seasonExistsInTeam).not.toHaveBeenCalled();
  });

  it('404s when the season is not in the team', async () => {
    harness.repository.seasonExistsInTeam.mockResolvedValue(false);
    await expect(
      harness.service.validate(TX, 'team-1', 'season-1'),
    ).rejects.toBeInstanceOf(CompetitionScopeNotFoundError);
  });

  it('requires the team on its own', async () => {
    await expect(
      harness.service.requireTeam(TX, 'team-1'),
    ).resolves.toBeUndefined();
    harness.repository.activeTeamExists.mockResolvedValue(false);
    await expect(
      harness.service.requireTeam(TX, 'team-1'),
    ).rejects.toBeInstanceOf(CompetitionScopeNotFoundError);
  });

  it('skips venue validation when none is supplied', async () => {
    await expect(
      harness.service.requireVenue(TX, 'team-1', null),
    ).resolves.toBeUndefined();
    expect(harness.repository.venueExistsInTeam).not.toHaveBeenCalled();
  });

  it('404s when the supplied venue is not in the team', async () => {
    harness.repository.venueExistsInTeam.mockResolvedValue(false);
    await expect(
      harness.service.requireVenue(TX, 'team-1', 'venue-1'),
    ).rejects.toBeInstanceOf(CompetitionScopeNotFoundError);
  });
});
