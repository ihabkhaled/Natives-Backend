import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlayerAssessmentNotFoundError } from '../errors/player-assessment-not-found.error';
import { PlayerAssessmentStatus } from '../model/player-assessments.enums';
import type { PlayerAssessment } from '../model/player-assessments.types';
import { PlayerAssessmentLookupService } from './player-assessment-lookup.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');

function assessment(): PlayerAssessment {
  return {
    id: 'a1',
    familyId: 'a1',
    teamId: 't1',
    seasonId: null,
    periodId: 'p1',
    templateId: 'tm1',
    membershipId: 'm1',
    evaluatorUserId: 'e1',
    status: PlayerAssessmentStatus.Draft,
    revision: 1,
    summary: null,
    recordVersion: 1,
    submittedAt: null,
    submittedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    publishedAt: null,
    publishedBy: null,
    supersededAt: null,
    supersededById: null,
    createdBy: 'e1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(found: PlayerAssessment | null) {
  const repository = { findForWrite: vi.fn().mockResolvedValue(found) };
  return {
    repository,
    service: new PlayerAssessmentLookupService(repository as never),
  };
}

describe('PlayerAssessmentLookupService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(assessment());
  });

  it('returns the assessment when found in scope', async () => {
    await expect(
      harness.service.requireForWrite(SCOPE, 't1', 'a1'),
    ).resolves.toMatchObject({ id: 'a1' });
  });

  it('throws not-found when the assessment is absent', async () => {
    const absent = build(null);
    await expect(
      absent.service.requireForWrite(SCOPE, 't1', 'missing'),
    ).rejects.toBeInstanceOf(PlayerAssessmentNotFoundError);
  });

  it('passes ownership for the owning evaluator', () => {
    expect(() =>
      harness.service.requireOwned(assessment(), 'e1'),
    ).not.toThrow();
  });

  it('hides another evaluator’s draft as not-found', () => {
    expect(() =>
      harness.service.requireOwned(assessment(), 'intruder'),
    ).toThrow(PlayerAssessmentNotFoundError);
  });
});
