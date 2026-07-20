import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompetitionValidationError } from '../errors/competition-validation.error';
import { CompetitionType } from '../model/competitions.enums';
import type { CreateCompetitionCommand } from '../model/competitions.types';
import { CreateCompetitionUseCase } from './create-competition.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'coach',
  email: 'c@x.test',
  roles: [],
};

function command(
  overrides: Partial<CreateCompetitionCommand['content']> = {},
): CreateCompetitionCommand {
  return {
    content: {
      name: 'Cairo Winter League',
      competitionType: CompetitionType.League,
      seasonId: 'season-1',
      genderDivision: null,
      organizerName: null,
      externalRef: null,
      startsOn: null,
      endsOn: null,
      description: null,
      ...overrides,
    },
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
  const idGenerator = { generate: vi.fn().mockReturnValue('comp-1') };
  const scope = { validate: vi.fn().mockResolvedValue(undefined) };
  const repository = {
    insert: vi.fn().mockResolvedValue({
      competitionId: 'comp-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      status: 'draft',
    }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CreateCompetitionUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    scope as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { scope, repository, audit, events, useCase };
}

describe('CreateCompetitionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates scope + content, writes the draft, audits, and emits created', async () => {
    const created = await harness.useCase.execute(ACTOR, 'team-1', command());
    expect(harness.scope.validate).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      'season-1',
    );
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
    expect(created.competitionId).toBe('comp-1');
  });

  it('rejects an inverted date window before writing', async () => {
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        command({ startsOn: '2026-03-01', endsOn: '2026-01-01' }),
      ),
    ).rejects.toBeInstanceOf(CompetitionValidationError);
    expect(harness.repository.insert).not.toHaveBeenCalled();
  });
});
