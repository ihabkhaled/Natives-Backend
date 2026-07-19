import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeasurementScopeNotFoundError } from '../errors/measurement-scope-not-found.error';
import { MeasurementScopeService } from './measurement-scope.service';

const tx = {} as never;

function build() {
  const repository = {
    activeTeamExists: vi.fn(),
    seasonExistsInTeam: vi.fn(),
    membershipExistsInTeam: vi.fn(),
    findActiveMembershipIdForUser: vi.fn(),
  };
  return {
    repository,
    service: new MeasurementScopeService(repository),
  };
}

describe('MeasurementScopeService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('accepts an active team with no season', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(true);
    await expect(
      harness.service.validate(tx, 'team-1', null),
    ).resolves.toBeUndefined();
    expect(harness.repository.seasonExistsInTeam).not.toHaveBeenCalled();
  });

  it('rejects a missing team', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(false);
    await expect(harness.service.validate(tx, 'team-1', null)).rejects.toThrow(
      MeasurementScopeNotFoundError,
    );
  });

  it('validates a supplied season and rejects a missing one', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(true);
    harness.repository.seasonExistsInTeam.mockResolvedValueOnce(true);
    await expect(
      harness.service.validate(tx, 'team-1', 'season-1'),
    ).resolves.toBeUndefined();
    harness.repository.seasonExistsInTeam.mockResolvedValueOnce(false);
    await expect(
      harness.service.validate(tx, 'team-1', 'season-1'),
    ).rejects.toThrow(MeasurementScopeNotFoundError);
  });

  it('requires a membership in the team', async () => {
    harness.repository.membershipExistsInTeam.mockResolvedValueOnce(true);
    await expect(
      harness.service.requireMembership(tx, 'team-1', 'member-1'),
    ).resolves.toBeUndefined();
    harness.repository.membershipExistsInTeam.mockResolvedValueOnce(false);
    await expect(
      harness.service.requireMembership(tx, 'team-1', 'member-1'),
    ).rejects.toThrow(MeasurementScopeNotFoundError);
  });

  it('resolves the caller membership or 404s', async () => {
    harness.repository.findActiveMembershipIdForUser.mockResolvedValueOnce(
      'member-1',
    );
    await expect(
      harness.service.resolveMembershipForUser(tx, 'team-1', 'user-1'),
    ).resolves.toBe('member-1');
    harness.repository.findActiveMembershipIdForUser.mockResolvedValueOnce(
      null,
    );
    await expect(
      harness.service.resolveMembershipForUser(tx, 'team-1', 'user-1'),
    ).rejects.toThrow(MeasurementScopeNotFoundError);
  });
});
