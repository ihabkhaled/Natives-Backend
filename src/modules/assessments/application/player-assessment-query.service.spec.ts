import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlayerAssessmentNotFoundError } from '../errors/player-assessment-not-found.error';
import { PlayerAssessmentStatus } from '../model/player-assessments.enums';
import type {
  PlayerAssessment,
  PlayerAssessmentValue,
} from '../model/player-assessments.types';
import { PlayerAssessmentQueryService } from './player-assessment-query.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');
const PAGE = { limit: 20, offset: 0 };

function assessment(id: string): PlayerAssessment {
  return {
    id,
    familyId: 'f1',
    teamId: 't1',
    seasonId: null,
    periodId: 'p1',
    templateId: 'tm1',
    membershipId: 'm1',
    evaluatorUserId: 'e1',
    status: PlayerAssessmentStatus.Published,
    revision: 1,
    summary: 'good',
    recordVersion: 1,
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
  };
}

const VALUE: PlayerAssessmentValue = {
  metricDefinitionId: 'metric-1',
  numericValue: 4,
  textValue: null,
  note: 'private',
  confidence: 3,
  observationCount: 2,
};

function build() {
  const repository = {
    listForTeam: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
    findDetail: vi
      .fn()
      .mockResolvedValue({ assessment: assessment('a1'), values: [VALUE] }),
    findForWrite: vi.fn().mockResolvedValue(assessment('a1')),
    listRevisions: vi.fn().mockResolvedValue({ items: [] }),
    listOwnPublished: vi
      .fn()
      .mockResolvedValue({ assessments: [assessment('a1')], total: 1 }),
    valuesByAssessment: vi.fn().mockResolvedValue(new Map([['a1', [VALUE]]])),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (s: never) => Promise<unknown>) => op(SCOPE)),
  };
  return {
    repository,
    service: new PlayerAssessmentQueryService(
      unitOfWork as never,
      repository as never,
    ),
  };
}

describe('PlayerAssessmentQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists the team page', async () => {
    const page = await harness.service.listForTeam('t1', PAGE);
    expect(page.total).toBe(0);
  });

  it('returns full team detail including private notes', async () => {
    const detail = await harness.service.getDetail('t1', 'a1');
    expect(detail.values[0]?.note).toBe('private');
  });

  it('throws not-found when detail is absent', async () => {
    harness.repository.findDetail.mockResolvedValueOnce(null);
    await expect(
      harness.service.getDetail('t1', 'missing'),
    ).rejects.toBeInstanceOf(PlayerAssessmentNotFoundError);
  });

  it('lists revisions by resolving the family first', async () => {
    await harness.service.listRevisions('t1', 'a1');
    expect(harness.repository.listRevisions).toHaveBeenCalledWith(
      SCOPE,
      't1',
      'f1',
    );
  });

  it('throws not-found for revisions of an unknown assessment', async () => {
    harness.repository.findForWrite.mockResolvedValueOnce(null);
    await expect(
      harness.service.listRevisions('t1', 'missing'),
    ).rejects.toBeInstanceOf(PlayerAssessmentNotFoundError);
  });

  it('returns own-published shaped without private notes', async () => {
    const page = await harness.service.listOwnPublished('t1', 'user-1', PAGE);
    expect(page.total).toBe(1);
    expect(JSON.stringify(page.items)).not.toContain('private');
    expect(page.items[0]?.values[0]).toEqual({
      metricDefinitionId: 'metric-1',
      numericValue: 4,
      textValue: null,
    });
  });

  it('tolerates an assessment with no stored values', async () => {
    harness.repository.valuesByAssessment.mockResolvedValueOnce(new Map());
    const page = await harness.service.listOwnPublished('t1', 'user-1', PAGE);
    expect(page.items[0]?.values).toEqual([]);
  });
});
