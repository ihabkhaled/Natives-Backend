import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentTemplateNotFoundError } from '../errors/assessment-template-not-found.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import type {
  AssessmentPeriod,
  CreatePeriodCommand,
} from '../model/assessments.types';
import { CreatePeriodUseCase } from './create-period.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = {
  userId: 'actor-1',
  email: 'a@example.test',
  roles: [],
} as never;

const COMMAND: CreatePeriodCommand = {
  seasonId: null,
  templateId: 'template-1',
  name: 'Q1 review window',
  cohort: null,
  startsOn: '2026-01-01',
  endsOn: '2026-03-31',
};

function period(): AssessmentPeriod {
  return {
    id: 'period-1',
    teamId: 'team-1',
    seasonId: null,
    templateId: 'template-1',
    name: 'Q1 review window',
    cohort: null,
    startsOn: '2026-01-01',
    endsOn: '2026-03-31',
    status: 'active' as never,
    recordVersion: 1,
    createdBy: 'actor-1',
    createdAt: NOW,
  };
}

function build() {
  const catalog = {
    publishedTemplateExists: vi.fn().mockResolvedValue(true),
    insertPeriod: vi.fn().mockResolvedValue(period()),
  };
  const scope = { validate: vi.fn().mockResolvedValue(undefined) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((operation: (s: never) => Promise<unknown>) =>
      operation(SCOPE),
    ),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('period-1') };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    catalog,
    scope,
    audit,
    useCase: new CreatePeriodUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      scope as never,
      catalog as never,
      audit as never,
    ),
  };
}

describe('CreatePeriodUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('opens a period against a published template and audits it', async () => {
    const created = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);
    expect(created.id).toBe('period-1');
    expect(harness.scope.validate).toHaveBeenCalledWith(SCOPE, 'team-1', null);
    expect(harness.catalog.insertPeriod).toHaveBeenCalledTimes(1);
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it('rejects a reversed date range before any write', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        startsOn: '2026-04-01',
        endsOn: '2026-03-31',
      }),
    ).rejects.toBeInstanceOf(AssessmentValidationError);
    expect(harness.scope.validate).not.toHaveBeenCalled();
  });

  it('rejects a period referencing a template that is not published', async () => {
    harness.catalog.publishedTemplateExists.mockResolvedValueOnce(false);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentTemplateNotFoundError);
    expect(harness.catalog.insertPeriod).not.toHaveBeenCalled();
  });
});
