import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PracticeTeamNotFoundError } from '../errors/practice-team-not-found.error';
import { SeasonScopeNotFoundError } from '../errors/season-scope-not-found.error';
import { VenueScopeNotFoundError } from '../errors/venue-scope-not-found.error';
import { ScopeValidationService } from './scope-validation.service';

const SCOPE = {} as never;

function build() {
  const scopes = {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    seasonExistsInTeam: vi.fn().mockResolvedValue(true),
    venueExistsInTeam: vi.fn().mockResolvedValue(true),
  };
  const service = new ScopeValidationService(scopes);
  return { service, scopes };
}

describe('ScopeValidationService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('passes when the team is active and references resolve', async () => {
    await expect(
      harness.service.validate(SCOPE, 'team-1', 'season-1', 'venue-1'),
    ).resolves.toBeUndefined();
  });

  it('skips season and venue checks when both are null', async () => {
    await harness.service.validate(SCOPE, 'team-1', null, null);
    expect(harness.scopes.seasonExistsInTeam).not.toHaveBeenCalled();
    expect(harness.scopes.venueExistsInTeam).not.toHaveBeenCalled();
  });

  it('rejects a missing or archived team', async () => {
    harness.scopes.activeTeamExists.mockResolvedValue(false);
    await expect(
      harness.service.validate(SCOPE, 'team-x', null, null),
    ).rejects.toBeInstanceOf(PracticeTeamNotFoundError);
  });

  it('rejects a season not in the team', async () => {
    harness.scopes.seasonExistsInTeam.mockResolvedValue(false);
    await expect(
      harness.service.validate(SCOPE, 'team-1', 'season-x', null),
    ).rejects.toBeInstanceOf(SeasonScopeNotFoundError);
  });

  it('rejects a venue not in the team', async () => {
    harness.scopes.venueExistsInTeam.mockResolvedValue(false);
    await expect(
      harness.service.validate(SCOPE, 'team-1', null, 'venue-x'),
    ).rejects.toBeInstanceOf(VenueScopeNotFoundError);
  });

  it('validateReferences checks season/venue without the team probe', async () => {
    await harness.service.validateReferences(SCOPE, 'team-1', 'season-1', null);
    expect(harness.scopes.activeTeamExists).not.toHaveBeenCalled();
    expect(harness.scopes.seasonExistsInTeam).toHaveBeenCalledOnce();
  });
});
