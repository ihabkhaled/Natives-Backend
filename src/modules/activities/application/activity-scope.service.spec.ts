import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityScopeNotFoundError } from '../errors/activity-scope-not-found.error';
import { ActivityScopeService } from './activity-scope.service';

function build() {
  const repository = {
    activeTeamExists: vi.fn(),
    seasonExistsInTeam: vi.fn(),
    findActiveMembershipId: vi.fn(),
    countActiveMembershipsInTeam: vi.fn(),
  };
  const service = new ActivityScopeService(repository);
  return { repository, service, tx: {} as never };
}

describe('ActivityScopeService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates an active team with no season', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(true);
    await expect(
      harness.service.validate(harness.tx, 't1', null),
    ).resolves.toBeUndefined();
    expect(harness.repository.seasonExistsInTeam).not.toHaveBeenCalled();
  });

  it('rejects a missing team', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(false);
    await expect(
      harness.service.validate(harness.tx, 't1', null),
    ).rejects.toBeInstanceOf(ActivityScopeNotFoundError);
  });

  it('validates and rejects a season within a team', async () => {
    harness.repository.activeTeamExists.mockResolvedValue(true);
    harness.repository.seasonExistsInTeam.mockResolvedValueOnce(true);
    await expect(
      harness.service.validate(harness.tx, 't1', 's1'),
    ).resolves.toBeUndefined();

    harness.repository.seasonExistsInTeam.mockResolvedValueOnce(false);
    await expect(
      harness.service.validate(harness.tx, 't1', 's2'),
    ).rejects.toBeInstanceOf(ActivityScopeNotFoundError);
  });

  it('resolves the acting membership or throws when there is none', async () => {
    harness.repository.findActiveMembershipId.mockResolvedValueOnce('m1');
    await expect(
      harness.service.resolveActingMembership(harness.tx, 't1', 'u1'),
    ).resolves.toBe('m1');

    harness.repository.findActiveMembershipId.mockResolvedValueOnce(null);
    await expect(
      harness.service.resolveActingMembership(harness.tx, 't1', 'u2'),
    ).rejects.toBeInstanceOf(ActivityScopeNotFoundError);
  });

  it('requires every buddy to be an active member', async () => {
    await expect(
      harness.service.requireBuddyMemberships(harness.tx, 't1', []),
    ).resolves.toBeUndefined();
    expect(
      harness.repository.countActiveMembershipsInTeam,
    ).not.toHaveBeenCalled();

    harness.repository.countActiveMembershipsInTeam.mockResolvedValueOnce(2);
    await expect(
      harness.service.requireBuddyMemberships(harness.tx, 't1', ['m2', 'm3']),
    ).resolves.toBeUndefined();

    harness.repository.countActiveMembershipsInTeam.mockResolvedValueOnce(1);
    await expect(
      harness.service.requireBuddyMemberships(harness.tx, 't1', ['m2', 'm3']),
    ).rejects.toBeInstanceOf(ActivityScopeNotFoundError);
  });
});
