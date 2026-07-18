import { describe, expect, it } from 'vitest';

import {
  PlayerAssessmentStatus,
  ReviewDecision,
} from '../model/player-assessments.enums';
import {
  allowedTransitions,
  canCorrect,
  canEditDraft,
  canPublish,
  canTransition,
  resolveReviewTarget,
  reviewNeedsIndependence,
} from './player-assessment.state-machine';

describe('allowedTransitions', () => {
  it('maps each state to its permitted next states', () => {
    expect(allowedTransitions(PlayerAssessmentStatus.Draft)).toEqual([
      PlayerAssessmentStatus.Submitted,
    ]);
    expect(allowedTransitions(PlayerAssessmentStatus.Submitted)).toEqual([
      PlayerAssessmentStatus.InReview,
      PlayerAssessmentStatus.Approved,
      PlayerAssessmentStatus.Draft,
    ]);
    expect(allowedTransitions(PlayerAssessmentStatus.InReview)).toEqual([
      PlayerAssessmentStatus.Approved,
      PlayerAssessmentStatus.Draft,
    ]);
    expect(allowedTransitions(PlayerAssessmentStatus.Approved)).toEqual([
      PlayerAssessmentStatus.Published,
    ]);
    expect(allowedTransitions(PlayerAssessmentStatus.Published)).toEqual([
      PlayerAssessmentStatus.Revised,
    ]);
    expect(allowedTransitions(PlayerAssessmentStatus.Revised)).toEqual([
      PlayerAssessmentStatus.Revised,
    ]);
  });

  it('returns an empty list for an unknown state', () => {
    expect(allowedTransitions('unknown' as PlayerAssessmentStatus)).toEqual([]);
  });
});

describe('canTransition', () => {
  it('permits the workflow transitions', () => {
    expect(
      canTransition(
        PlayerAssessmentStatus.Draft,
        PlayerAssessmentStatus.Submitted,
      ),
    ).toBe(true);
    expect(
      canTransition(
        PlayerAssessmentStatus.InReview,
        PlayerAssessmentStatus.Approved,
      ),
    ).toBe(true);
    expect(
      canTransition(
        PlayerAssessmentStatus.Approved,
        PlayerAssessmentStatus.Published,
      ),
    ).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(
      canTransition(
        PlayerAssessmentStatus.Draft,
        PlayerAssessmentStatus.Published,
      ),
    ).toBe(false);
    expect(
      canTransition(
        PlayerAssessmentStatus.Published,
        PlayerAssessmentStatus.Draft,
      ),
    ).toBe(false);
  });
});

describe('canEditDraft', () => {
  it('is true only for a draft', () => {
    expect(canEditDraft(PlayerAssessmentStatus.Draft)).toBe(true);
    expect(canEditDraft(PlayerAssessmentStatus.Submitted)).toBe(false);
    expect(canEditDraft(PlayerAssessmentStatus.Published)).toBe(false);
  });
});

describe('canPublish', () => {
  it('is true only for an approved assessment', () => {
    expect(canPublish(PlayerAssessmentStatus.Approved)).toBe(true);
    expect(canPublish(PlayerAssessmentStatus.Submitted)).toBe(false);
    expect(canPublish(PlayerAssessmentStatus.Published)).toBe(false);
  });
});

describe('canCorrect', () => {
  it('is true only for published or revised', () => {
    expect(canCorrect(PlayerAssessmentStatus.Published)).toBe(true);
    expect(canCorrect(PlayerAssessmentStatus.Revised)).toBe(true);
    expect(canCorrect(PlayerAssessmentStatus.Approved)).toBe(false);
    expect(canCorrect(PlayerAssessmentStatus.Draft)).toBe(false);
  });
});

describe('resolveReviewTarget', () => {
  it('maps each decision to its target state', () => {
    expect(resolveReviewTarget(ReviewDecision.StartReview)).toBe(
      PlayerAssessmentStatus.InReview,
    );
    expect(resolveReviewTarget(ReviewDecision.Approve)).toBe(
      PlayerAssessmentStatus.Approved,
    );
    expect(resolveReviewTarget(ReviewDecision.Reject)).toBe(
      PlayerAssessmentStatus.Draft,
    );
  });
});

describe('reviewNeedsIndependence', () => {
  it('requires independence for claim and approve, not reject', () => {
    expect(reviewNeedsIndependence(ReviewDecision.StartReview)).toBe(true);
    expect(reviewNeedsIndependence(ReviewDecision.Approve)).toBe(true);
    expect(reviewNeedsIndependence(ReviewDecision.Reject)).toBe(false);
  });
});
