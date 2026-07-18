import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvalidAssessmentTransitionError } from '../errors/invalid-assessment-transition.error';
import { PlayerAssessmentStatus } from '../model/player-assessments.enums';
import type {
  CorrectPlayerAssessmentCommand,
  PlayerAssessment,
} from '../model/player-assessments.types';
import { CorrectPlayerAssessmentUseCase } from './correct-player-assessment.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');
const ACTOR = { userId: 'admin', email: 'a@example.test', roles: [] } as never;

const BOUNDS = [
  {
    metricDefinitionId: 'metric-1',
    required: true,
    minimumValue: 0,
    maximumValue: 5,
  },
];

const COMMAND: CorrectPlayerAssessmentCommand = {
  reason: 'fixed a keying error',
  summary: 'corrected',
  values: [
    {
      metricDefinitionId: 'metric-1',
      numericValue: 5,
      textValue: null,
      note: null,
      confidence: null,
      observationCount: null,
    },
  ],
};

function published(
  overrides: Partial<PlayerAssessment> = {},
): PlayerAssessment {
  return {
    id: 'a1',
    familyId: 'f1',
    teamId: 't1',
    seasonId: null,
    periodId: 'p1',
    templateId: 'tm1',
    membershipId: 'm1',
    evaluatorUserId: 'e1',
    status: PlayerAssessmentStatus.Published,
    revision: 1,
    summary: null,
    recordVersion: 4,
    submittedAt: NOW,
    submittedBy: 'e1',
    reviewedAt: NOW,
    reviewedBy: 'r1',
    publishedAt: NOW,
    publishedBy: 'p1',
    supersededAt: null,
    supersededById: null,
    createdBy: 'e1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function build() {
  const lookup = { requireForWrite: vi.fn().mockResolvedValue(published()) };
  const repository = {
    loadTemplateBounds: vi.fn().mockResolvedValue(BOUNDS),
    supersede: vi.fn().mockResolvedValue(true),
    insertAssessment: vi.fn().mockResolvedValue(
      published({
        id: 'a2',
        revision: 2,
        status: PlayerAssessmentStatus.Revised,
      }),
    ),
    insertValues: vi.fn().mockResolvedValue(undefined),
    findValues: vi.fn().mockResolvedValue([]),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (s: never) => Promise<unknown>) => op(SCOPE)),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('a2') };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    lookup,
    repository,
    audit,
    events,
    useCase: new CorrectPlayerAssessmentUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      lookup as never,
      repository as never,
      audit as never,
      events as never,
    ),
  };
}

describe('CorrectPlayerAssessmentUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('supersedes the published row and inserts a revised revision', async () => {
    const detail = await harness.useCase.execute(ACTOR, 't1', 'a1', COMMAND);
    expect(detail.assessment.status).toBe(PlayerAssessmentStatus.Revised);
    expect(detail.assessment.revision).toBe(2);
    expect(harness.repository.supersede).toHaveBeenCalledTimes(1);
    expect(harness.repository.insertAssessment).toHaveBeenCalledTimes(1);
    expect(harness.events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('rejects correcting an assessment that is not published', async () => {
    harness.lookup.requireForWrite.mockResolvedValueOnce(
      published({ status: PlayerAssessmentStatus.Draft }),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'a1', COMMAND),
    ).rejects.toBeInstanceOf(InvalidAssessmentTransitionError);
    expect(harness.repository.supersede).not.toHaveBeenCalled();
  });

  it('rejects correcting an already-superseded row', async () => {
    harness.lookup.requireForWrite.mockResolvedValueOnce(
      published({ supersededAt: NOW }),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'a1', COMMAND),
    ).rejects.toBeInstanceOf(InvalidAssessmentTransitionError);
  });

  it('fails when the supersede loses a concurrency race', async () => {
    harness.repository.supersede.mockResolvedValueOnce(false);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'a1', COMMAND),
    ).rejects.toBeInstanceOf(InvalidAssessmentTransitionError);
    expect(harness.repository.insertAssessment).not.toHaveBeenCalled();
  });
});
