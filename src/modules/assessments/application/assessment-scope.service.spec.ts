import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentScopeNotFoundError } from '../errors/assessment-scope-not-found.error';
import { AssessmentScopeService } from './assessment-scope.service';

const SCOPE = {} as never;

function build() {
  const repository = {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    seasonExistsInTeam: vi.fn().mockResolvedValue(true),
  };
  return {
    repository,
    service: new AssessmentScopeService(repository),
  };
}

describe('AssessmentScopeService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('accepts an active team and an owned season', async () => {
    await expect(
      harness.service.validate(SCOPE, 'team-1', 'season-1'),
    ).resolves.toBeUndefined();
  });

  it('skips the season probe when season is null', async () => {
    await harness.service.validate(SCOPE, 'team-1', null);
    expect(harness.repository.seasonExistsInTeam).not.toHaveBeenCalled();
  });

  it('hides a missing team or cross-team season behind not-found', async () => {
    harness.repository.activeTeamExists.mockResolvedValueOnce(false);
    await expect(
      harness.service.validate(SCOPE, 'team-x', null),
    ).rejects.toBeInstanceOf(AssessmentScopeNotFoundError);
    harness.repository.seasonExistsInTeam.mockResolvedValueOnce(false);
    await expect(
      harness.service.validate(SCOPE, 'team-1', 'season-x'),
    ).rejects.toBeInstanceOf(AssessmentScopeNotFoundError);
  });
});

