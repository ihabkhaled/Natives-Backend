import type { AuthUserIdentity } from '@core/auth';
import { describe, expect, it, vi } from 'vitest';

import { OpponentConflictError } from '../errors/opponent-conflict.error';
import { CreateOpponentUseCase } from './create-opponent.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'coach',
  email: 'c@x.test',
  roles: [],
};

function content() {
  return {
    name: 'Alexandria Sharks',
    shortName: null,
    logoRef: null,
    contactName: null,
    contactInfo: null,
    notes: null,
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = {
    now: vi.fn().mockReturnValue(new Date('2026-02-01T00:00:00Z')),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('opp-1') };
  const scope = { requireTeam: vi.fn().mockResolvedValue(undefined) };
  const repository = {
    insert: vi
      .fn()
      .mockResolvedValue({ opponentId: 'opp-1', teamId: 'team-1' }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CreateOpponentUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    scope as never,
    repository as never,
    audit as never,
  );
  return { scope, repository, audit, useCase };
}

describe('CreateOpponentUseCase', () => {
  it('validates the team, writes the opponent, and audits', async () => {
    const harness = build();
    const opponent = await harness.useCase.execute(ACTOR, 'team-1', {
      content: content(),
    });
    expect(harness.scope.requireTeam).toHaveBeenCalledOnce();
    expect(opponent.opponentId).toBe('opp-1');
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('409s a duplicate opponent name', async () => {
    const harness = build();
    harness.repository.insert.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', { content: content() }),
    ).rejects.toBeInstanceOf(OpponentConflictError);
    expect(harness.audit.record).not.toHaveBeenCalled();
  });
});
