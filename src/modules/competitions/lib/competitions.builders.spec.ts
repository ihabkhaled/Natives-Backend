import { describe, expect, it } from 'vitest';

import {
  CompetitionStatus,
  CompetitionType,
  FixtureStatus,
  MatchSide,
} from '../model/competitions.enums';
import type { Competition, Fixture } from '../model/competitions.types';
import {
  buildCompetitionCancelledEvent,
  buildCompetitionPublishedEvent,
  buildCompetitionStatusChange,
  buildFixtureAudit,
  buildFixtureReschedule,
  buildFixtureRescheduledEvent,
  buildFixtureStatusChange,
} from './competitions.builders';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const EARLIER = new Date('2026-02-01T09:00:00.000Z');

function competition(overrides: Partial<Competition> = {}): Competition {
  return {
    competitionId: 'comp-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    name: 'Cairo League',
    competitionType: CompetitionType.League,
    status: CompetitionStatus.Draft,
    genderDivision: null,
    organizerName: null,
    externalRef: null,
    startsOn: null,
    endsOn: null,
    description: null,
    cancellationReason: null,
    recordVersion: 1,
    createdBy: 'user-1',
    publishedBy: null,
    publishedAt: null,
    activatedAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

function fixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    fixtureId: 'fixture-1',
    competitionId: 'comp-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    stageId: null,
    roundId: null,
    opponentId: 'opp-1',
    venueId: 'venue-1',
    homeAway: MatchSide.Home,
    scheduledAt: EARLIER,
    status: FixtureStatus.Scheduled,
    rescheduleCount: 0,
    previousScheduledAt: null,
    rescheduleReason: null,
    cancellationReason: null,
    recordVersion: 1,
    createdBy: 'user-1',
    rescheduledAt: null,
    finalizedAt: null,
    cancelledAt: null,
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

describe('competitions builders', () => {
  it('stamps publication on a publish transition', () => {
    const change = buildCompetitionStatusChange(
      competition(),
      'team-1',
      CompetitionStatus.Published,
      'user-9',
      null,
      1,
      NOW,
    );
    expect(change.publishedBy).toBe('user-9');
    expect(change.publishedAt).toBe(NOW);
    expect(change.cancelledAt).toBeNull();
    expect(change.archivedAt).toBeNull();
  });

  it('stamps the cancellation reason and instant on a cancel', () => {
    const change = buildCompetitionStatusChange(
      competition({ status: CompetitionStatus.Active }),
      'team-1',
      CompetitionStatus.Cancelled,
      'user-9',
      'venue lost',
      3,
      NOW,
    );
    expect(change.cancelledAt).toBe(NOW);
    expect(change.cancellationReason).toBe('venue lost');
    expect(change.expectedRecordVersion).toBe(3);
  });

  it('stamps activation and completion instants on their transitions', () => {
    const activated = buildCompetitionStatusChange(
      competition({ status: CompetitionStatus.Published }),
      'team-1',
      CompetitionStatus.Active,
      'user-9',
      null,
      1,
      NOW,
    );
    expect(activated.activatedAt).toBe(NOW);
    const completed = buildCompetitionStatusChange(
      competition({ status: CompetitionStatus.Active }),
      'team-1',
      CompetitionStatus.Completed,
      'user-9',
      null,
      1,
      NOW,
    );
    expect(completed.completedAt).toBe(NOW);
    expect(completed.archivedAt).toBeNull();
  });

  it('stamps archival when archiving a cancelled competition', () => {
    const change = buildCompetitionStatusChange(
      competition({
        status: CompetitionStatus.Cancelled,
        cancelledAt: EARLIER,
      }),
      'team-1',
      CompetitionStatus.Archived,
      'user-9',
      null,
      1,
      NOW,
    );
    expect(change.archivedAt).toBe(NOW);
    expect(change.cancelledAt).toBe(EARLIER);
  });

  it('builds published and cancelled competition events', () => {
    const published = buildCompetitionPublishedEvent(
      competition({ status: CompetitionStatus.Published }),
      'user-9',
    );
    expect(published.eventType).toBe('competition.published.v1');
    expect(published.payload['status']).toBe('published');
    const cancelled = buildCompetitionCancelledEvent(
      competition({ status: CompetitionStatus.Cancelled }),
      'user-9',
    );
    expect(cancelled.eventType).toBe('competition.cancelled.v1');
  });

  it('captures the previous instant when rescheduling a fixture', () => {
    const reschedule = buildFixtureReschedule(
      fixture(),
      'team-1',
      NOW,
      null,
      'weather',
      1,
      NOW,
    );
    expect(reschedule.previousScheduledAt).toBe(EARLIER);
    expect(reschedule.newScheduledAt).toBe(NOW);
    expect(reschedule.venueId).toBe('venue-1');
    expect(reschedule.reason).toBe('weather');
  });

  it('emits the previous instant in the rescheduled event payload', () => {
    const event = buildFixtureRescheduledEvent(
      fixture({ previousScheduledAt: EARLIER, scheduledAt: NOW }),
      'user-9',
    );
    expect(event.eventType).toBe('fixture.rescheduled.v1');
    expect(event.payload['previousScheduledAt']).toBe(EARLIER.toISOString());
    expect(event.payload['scheduledAt']).toBe(NOW.toISOString());
  });

  it('stamps the settled instant on finalize and keeps a cancelled fixture', () => {
    const finalized = buildFixtureStatusChange(
      fixture({ status: FixtureStatus.Live }),
      'team-1',
      FixtureStatus.Final,
      null,
      1,
      NOW,
    );
    expect(finalized.finalizedAt).toBe(NOW);
    const cancelled = buildFixtureStatusChange(
      fixture(),
      'team-1',
      FixtureStatus.Cancelled,
      'forfeit',
      1,
      NOW,
    );
    expect(cancelled.cancelledAt).toBe(NOW);
    expect(cancelled.cancellationReason).toBe('forfeit');
  });

  it('builds a fixture audit that carries safe scalars only', () => {
    const audit = buildFixtureAudit('fixture.created', 'user-9', fixture());
    expect(audit.resourceId).toBe('fixture-1');
    expect(audit.diff['opponentId']).toBe('opp-1');
    expect(audit.teamId).toBe('team-1');
  });
});
