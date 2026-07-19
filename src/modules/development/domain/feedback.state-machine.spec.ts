import { describe, expect, it } from 'vitest';

import { FeedbackStatus } from '../model/feedback.enums';
import {
  allowedFeedbackTransitions,
  canCorrectFeedback,
  canEditFeedbackDraft,
  canPublishFeedback,
  canTransitionFeedback,
} from './feedback.state-machine';

describe('feedback state machine', () => {
  it('exposes the allowed transitions per state', () => {
    expect(allowedFeedbackTransitions(FeedbackStatus.Draft)).toEqual([
      FeedbackStatus.InReview,
    ]);
    expect(allowedFeedbackTransitions(FeedbackStatus.InReview)).toEqual([
      FeedbackStatus.Published,
      FeedbackStatus.Draft,
    ]);
    expect(allowedFeedbackTransitions(FeedbackStatus.Published)).toEqual([
      FeedbackStatus.Revised,
    ]);
    expect(allowedFeedbackTransitions(FeedbackStatus.Revised)).toEqual([
      FeedbackStatus.Revised,
    ]);
  });

  it('permits only the modelled transitions', () => {
    expect(
      canTransitionFeedback(FeedbackStatus.Draft, FeedbackStatus.InReview),
    ).toBe(true);
    expect(
      canTransitionFeedback(FeedbackStatus.InReview, FeedbackStatus.Published),
    ).toBe(true);
    expect(
      canTransitionFeedback(FeedbackStatus.InReview, FeedbackStatus.Draft),
    ).toBe(true);
    expect(
      canTransitionFeedback(FeedbackStatus.Draft, FeedbackStatus.Published),
    ).toBe(false);
  });

  it('recognises the editable draft state only', () => {
    expect(canEditFeedbackDraft(FeedbackStatus.Draft)).toBe(true);
    expect(canEditFeedbackDraft(FeedbackStatus.InReview)).toBe(false);
  });

  it('recognises the publishable in-review state only', () => {
    expect(canPublishFeedback(FeedbackStatus.InReview)).toBe(true);
    expect(canPublishFeedback(FeedbackStatus.Draft)).toBe(false);
    expect(canPublishFeedback(FeedbackStatus.Published)).toBe(false);
  });

  it('permits correcting published and revised records', () => {
    expect(canCorrectFeedback(FeedbackStatus.Published)).toBe(true);
    expect(canCorrectFeedback(FeedbackStatus.Revised)).toBe(true);
    expect(canCorrectFeedback(FeedbackStatus.Draft)).toBe(false);
    expect(canCorrectFeedback(FeedbackStatus.InReview)).toBe(false);
  });
});
