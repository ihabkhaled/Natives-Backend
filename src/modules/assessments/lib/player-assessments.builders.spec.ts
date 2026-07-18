import { describe, expect, it } from 'vitest';

import {
  ASSESSMENT_PUBLISHED_EVENT,
  ASSESSMENT_REVISED_EVENT,
  ASSESSMENT_SUBMITTED_EVENT,
} from '../model/player-assessments.constants';
import {
  PlayerAssessmentStatus,
  ReviewDecision,
} from '../model/player-assessments.enums';
import type {
  AssessmentValueInput,
  CreatePlayerAssessmentCommand,
  PlayerAssessment,
  PlayerAssessmentContext,
} from '../model/player-assessments.types';
import {
  buildAudit,
  buildCorrectionAssessment,
  buildNewAssessment,
  buildPublishedEvent,
  buildPublishTransition,
  buildReviewTransition,
  buildRevisedEvent,
  buildSubmittedEvent,
  buildSubmitTransition,
  buildSupersede,
  buildValueRows,
} from './player-assessments.builders';

const NOW = new Date('2026-06-01T00:00:00.000Z');

function assessment(
  overrides: Partial<PlayerAssessment> = {},
): PlayerAssessment {
  return {
    id: 'a1',
    familyId: 'f1',
    teamId: 't1',
    seasonId: 's1',
    periodId: 'p1',
    templateId: 'tm1',
    membershipId: 'm1',
    evaluatorUserId: 'e1',
    status: PlayerAssessmentStatus.Submitted,
    revision: 1,
    summary: null,
    recordVersion: 2,
    submittedAt: NOW,
    submittedBy: 'e1',
    reviewedAt: null,
    reviewedBy: null,
    publishedAt: null,
    publishedBy: null,
    supersededAt: null,
    supersededById: null,
    createdBy: 'e1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const CONTEXT: PlayerAssessmentContext = {
  templateId: 'tm1',
  seasonId: 's1',
  metrics: [],
};

const COMMAND: CreatePlayerAssessmentCommand = {
  periodId: 'p1',
  membershipId: 'm1',
  summary: 'draft note',
  values: [],
};

const VALUE: AssessmentValueInput = {
  metricDefinitionId: 'metric-1',
  numericValue: null,
  textValue: null,
  note: null,
  confidence: null,
  observationCount: null,
};

describe('buildNewAssessment', () => {
  it('starts a draft as its own family at revision 1', () => {
    const draft = buildNewAssessment('a1', 't1', CONTEXT, COMMAND, 'e1', NOW);
    expect(draft.familyId).toBe('a1');
    expect(draft.status).toBe(PlayerAssessmentStatus.Draft);
    expect(draft.revision).toBe(1);
    expect(draft.seasonId).toBe('s1');
    expect(draft.evaluatorUserId).toBe('e1');
    expect(draft.publishedAt).toBeNull();
  });
});

describe('buildCorrectionAssessment', () => {
  it('builds a superseding revised revision, keeping the family', () => {
    const previous = assessment({
      status: PlayerAssessmentStatus.Published,
      revision: 2,
      reviewedBy: 'r1',
    });
    const revision = buildCorrectionAssessment(
      'a2',
      previous,
      'corrected',
      'admin',
      NOW,
    );
    expect(revision.familyId).toBe('f1');
    expect(revision.revision).toBe(3);
    expect(revision.status).toBe(PlayerAssessmentStatus.Revised);
    expect(revision.publishedBy).toBe('admin');
    expect(revision.reviewedBy).toBe('r1');
    expect(revision.summary).toBe('corrected');
  });
});

describe('buildValueRows', () => {
  it('maps inputs with generated ids', () => {
    let counter = 0;
    const nextId = (): string => {
      counter += 1;
      return `id-${counter}`;
    };
    const rows = buildValueRows('a1', [VALUE], nextId, NOW);
    expect(rows).toEqual([
      {
        id: 'id-1',
        assessmentId: 'a1',
        metricDefinitionId: 'metric-1',
        numericValue: null,
        textValue: null,
        note: null,
        confidence: null,
        observationCount: null,
        now: NOW,
      },
    ]);
  });
});

describe('workflow transition builders', () => {
  it('stamps the submitter on submit', () => {
    const transition = buildSubmitTransition('a1', 't1', 2, 'e1', NOW);
    expect(transition.toStatus).toBe(PlayerAssessmentStatus.Submitted);
    expect(transition.submittedBy).toBe('e1');
    expect(transition.reviewedBy).toBeNull();
  });

  it('stamps the reviewer only when approving', () => {
    const approve = buildReviewTransition(
      'a1',
      't1',
      ReviewDecision.Approve,
      2,
      'r1',
      NOW,
    );
    expect(approve.toStatus).toBe(PlayerAssessmentStatus.Approved);
    expect(approve.reviewedBy).toBe('r1');

    const claim = buildReviewTransition(
      'a1',
      't1',
      ReviewDecision.StartReview,
      2,
      'r1',
      NOW,
    );
    expect(claim.toStatus).toBe(PlayerAssessmentStatus.InReview);
    expect(claim.reviewedBy).toBeNull();
  });

  it('stamps the publisher on publish', () => {
    const transition = buildPublishTransition('a1', 't1', 2, 'p1', NOW);
    expect(transition.toStatus).toBe(PlayerAssessmentStatus.Published);
    expect(transition.publishedBy).toBe('p1');
  });
});

describe('buildSupersede', () => {
  it('points the prior row at its replacement', () => {
    expect(buildSupersede('a1', 'a2', NOW)).toEqual({
      id: 'a1',
      supersededById: 'a2',
      now: NOW,
    });
  });
});

describe('domain event builders', () => {
  it('builds a submitted event actored by the submitter', () => {
    const event = buildSubmittedEvent(assessment());
    expect(event.eventType).toBe(ASSESSMENT_SUBMITTED_EVENT);
    expect(event.actorUserId).toBe('e1');
    expect(event.payload['supersededId']).toBeNull();
  });

  it('builds a published event actored by the publisher', () => {
    const event = buildPublishedEvent(
      assessment({
        status: PlayerAssessmentStatus.Published,
        publishedBy: 'admin',
      }),
    );
    expect(event.eventType).toBe(ASSESSMENT_PUBLISHED_EVENT);
    expect(event.actorUserId).toBe('admin');
  });

  it('builds a revised event carrying the superseded id', () => {
    const event = buildRevisedEvent(
      assessment({
        status: PlayerAssessmentStatus.Revised,
        publishedBy: 'admin',
      }),
      'old-id',
    );
    expect(event.eventType).toBe(ASSESSMENT_REVISED_EVENT);
    expect(event.payload['supersededId']).toBe('old-id');
  });
});

describe('buildAudit', () => {
  it('records a redaction-safe scalar diff', () => {
    const audit = buildAudit('assessment.player.created', 'e1', assessment());
    expect(audit.resourceId).toBe('a1');
    expect(audit.diff).toEqual({
      status: PlayerAssessmentStatus.Submitted,
      revision: 1,
      recordVersion: 2,
    });
  });
});
