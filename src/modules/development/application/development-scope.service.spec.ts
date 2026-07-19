import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevelopmentScopeNotFoundError } from '../errors/development-scope-not-found.error';
import { DevelopmentScopeService } from './development-scope.service';

function build() {
  const repository = {
    activeTeamExists: vi.fn(),
    seasonExistsInTeam: vi.fn(),
    membershipExistsInTeam: vi.fn(),
  };
  const service = new DevelopmentScopeService(repository);
  return { repository, service, tx: {} as never };
}

describe('DevelopmentScopeService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('passes when the team exists and no season is required', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(true);
    await expect(
      harness.service.validate(harness.tx, 'team-1', null),
    ).resolves.toBeUndefined();
    expect(harness.repository.seasonExistsInTeam).not.toHaveBeenCalled();
  });

  it('rejects a missing team', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(false);
    await expect(
      harness.service.validate(harness.tx, 'team-x', null),
    ).rejects.toBeInstanceOf(DevelopmentScopeNotFoundError);
  });

  it('validates an in-team season when supplied', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(true);
    harness.repository.seasonExistsInTeam.mockResolvedValue(true);
    await expect(
      harness.service.validate(harness.tx, 'team-1', 'season-1'),
    ).resolves.toBeUndefined();
  });

  it('rejects a season outside the team', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(true);
    harness.repository.seasonExistsInTeam.mockResolvedValue(false);
    await expect(
      harness.service.validate(harness.tx, 'team-1', 'season-x'),
    ).rejects.toBeInstanceOf(DevelopmentScopeNotFoundError);
  });

  it('requires an in-team membership', async () => {
    harness.repository.membershipExistsInTeam.mockResolvedValue(true);
    await expect(
      harness.service.requireMembership(harness.tx, 'team-1', 'mem-1'),
    ).resolves.toBeUndefined();
    harness.repository.membershipExistsInTeam.mockResolvedValue(false);
    await expect(
      harness.service.requireMembership(harness.tx, 'team-1', 'mem-x'),
    ).rejects.toBeInstanceOf(DevelopmentScopeNotFoundError);
  });
});
