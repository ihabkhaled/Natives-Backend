import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PointsScopeNotFoundError } from '../errors/points-scope-not-found.error';
import { PointsScopeService } from './points-scope.service';

function build() {
  const repository = {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    seasonExistsInTeam: vi.fn().mockResolvedValue(true),
    membershipExistsInTeam: vi.fn().mockResolvedValue(true),
    membershipForUser: vi.fn().mockResolvedValue('mem-1'),
  };
  const service = new PointsScopeService(repository);
  return { repository, service, tx: {} as never };
}

describe('PointsScopeService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('passes when the team and season exist', async () => {
    await expect(
      harness.service.validate(harness.tx, 'team-1', 'season-1'),
    ).resolves.toBeUndefined();
  });

  it('skips the season check when no season is scoped', async () => {
    await harness.service.validate(harness.tx, 'team-1', null);
    expect(harness.repository.seasonExistsInTeam).not.toHaveBeenCalled();
  });

  it('rejects a missing team', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(false);
    await expect(
      harness.service.validate(harness.tx, 'team-1', null),
    ).rejects.toBeInstanceOf(PointsScopeNotFoundError);
  });

  it('rejects a missing season', async () => {
    harness.repository.seasonExistsInTeam.mockResolvedValue(false);
    await expect(
      harness.service.validate(harness.tx, 'team-1', 'season-1'),
    ).rejects.toBeInstanceOf(PointsScopeNotFoundError);
  });

  it('requires an existing membership', async () => {
    await harness.service.requireMembership(harness.tx, 'team-1', 'mem-1');
    harness.repository.membershipExistsInTeam.mockResolvedValue(false);
    await expect(
      harness.service.requireMembership(harness.tx, 'team-1', 'mem-1'),
    ).rejects.toBeInstanceOf(PointsScopeNotFoundError);
  });

  it('resolves the caller own membership or 404s', async () => {
    expect(
      await harness.service.requireOwnMembership(harness.tx, 'team-1', 'u'),
    ).toBe('mem-1');
    harness.repository.membershipForUser.mockResolvedValue(null);
    await expect(
      harness.service.requireOwnMembership(harness.tx, 'team-1', 'u'),
    ).rejects.toBeInstanceOf(PointsScopeNotFoundError);
  });
});
