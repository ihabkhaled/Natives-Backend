import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScoringScopeNotFoundError } from '../errors/scoring-scope-not-found.error';
import { ScoringScopeService } from './scoring-scope.service';

function build() {
  const repository = {
    activeTeamExists: vi.fn(() => true),
    seasonExistsInTeam: vi.fn(() => true),
    membershipExistsInTeam: vi.fn(() => true),
  };
  const service = new ScoringScopeService(repository as never);
  return { repository, service, tx: {} as never };
}

describe('ScoringScopeService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('accepts an active team with no season', async () => {
    await expect(
      harness.service.validate(harness.tx, 'team-1', null),
    ).resolves.toBeUndefined();
  });

  it('validates a provided season', async () => {
    await expect(
      harness.service.validate(harness.tx, 'team-1', 'season-1'),
    ).resolves.toBeUndefined();
    expect(harness.repository.seasonExistsInTeam).toHaveBeenCalled();
  });

  it('rejects a missing team', async () => {
    harness.repository.activeTeamExists.mockReturnValueOnce(false);
    await expect(
      harness.service.validate(harness.tx, 'team-1', null),
    ).rejects.toBeInstanceOf(ScoringScopeNotFoundError);
  });

  it('rejects a missing season', async () => {
    harness.repository.seasonExistsInTeam.mockReturnValueOnce(false);
    await expect(
      harness.service.validate(harness.tx, 'team-1', 'season-1'),
    ).rejects.toBeInstanceOf(ScoringScopeNotFoundError);
  });

  it('requires a membership to exist', async () => {
    await expect(
      harness.service.requireMembership(harness.tx, 'team-1', 'mem-1'),
    ).resolves.toBeUndefined();
    harness.repository.membershipExistsInTeam.mockReturnValueOnce(false);
    await expect(
      harness.service.requireMembership(harness.tx, 'team-1', 'mem-1'),
    ).rejects.toBeInstanceOf(ScoringScopeNotFoundError);
  });
});
