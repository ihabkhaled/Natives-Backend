/**
 * Lifecycle of a single coach feedback record. `draft` is the coach's private
 * working copy (never visible to the player); `in_review` is submitted for a
 * second read; `published` is the immutable, player-visible result shared WITH
 * the assessed member; `revised` is a superseding published correction. A
 * published or revised snapshot is never edited in place — corrections append a
 * new revision. At every stage the coach-only note stays private.
 */
export enum FeedbackStatus {
  Draft = 'draft',
  InReview = 'in_review',
  Published = 'published',
  Revised = 'revised',
}

export const FEEDBACK_STATUS_VALUES: readonly FeedbackStatus[] =
  Object.values(FeedbackStatus);
