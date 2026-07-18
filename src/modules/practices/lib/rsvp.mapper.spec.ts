import { describe, expect, it } from 'vitest';

import {
  RsvpNoteVisibility,
  RsvpSource,
  RsvpStatus,
} from '../model/rsvp.enums';
import type { PracticeRsvp, RsvpCounts } from '../model/rsvp.types';
import { noResponseView, toRsvpSummary, toRsvpView } from './rsvp.mapper';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function rsvp(): PracticeRsvp {
  return {
    id: 'rsvp-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    userId: 'user-1',
    status: RsvpStatus.Going,
    reasonCategory: null,
    note: 'here',
    noteVisibility: RsvpNoteVisibility.Coaches,
    source: RsvpSource.Self,
    waitlisted: true,
    respondedAt: NOW,
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 3,
  };
}

const COUNTS: RsvpCounts = {
  going: 8,
  waitlisted: 2,
  notGoing: 1,
  maybe: 3,
  noResponse: 0,
};

describe('toRsvpView', () => {
  it('projects the stored row with its version and waitlist flag', () => {
    const view = toRsvpView(rsvp());
    expect(view).toMatchObject({
      sessionId: 'ses-1',
      membershipId: 'mem-1',
      status: RsvpStatus.Going,
      waitlisted: true,
      version: 3,
    });
  });
});

describe('noResponseView', () => {
  it('models absence as an explicit no_response with null metadata', () => {
    const view = noResponseView('ses-2', 'mem-2');
    expect(view).toEqual({
      sessionId: 'ses-2',
      membershipId: 'mem-2',
      status: RsvpStatus.NoResponse,
      reasonCategory: null,
      note: null,
      noteVisibility: null,
      source: null,
      waitlisted: false,
      respondedAt: null,
      version: null,
    });
  });
});

describe('toRsvpSummary', () => {
  it('derives remaining spots for a capped session (never below zero)', () => {
    expect(toRsvpSummary('ses-1', 10, COUNTS).spotsRemaining).toBe(2);
    expect(toRsvpSummary('ses-1', 5, COUNTS).spotsRemaining).toBe(0);
  });

  it('leaves remaining spots null for an uncapped session (null-not-zero)', () => {
    const summary = toRsvpSummary('ses-1', null, COUNTS);
    expect(summary.capacity).toBeNull();
    expect(summary.spotsRemaining).toBeNull();
    expect(summary.going).toBe(8);
    expect(summary.waitlisted).toBe(2);
  });
});
