import { AuditOutcome } from '@modules/platform';
import { describe, expect, it } from 'vitest';

import {
  AGENDA_PUBLISHED_EVENT,
  BLOCK_RESOURCE_TYPE,
  DRILL_CREATED_ACTION,
} from '../model/agendas.constants';
import {
  AgendaBlockType,
  AgendaStatus,
  CompletionStatus,
  DrillCategory,
  DrillIntensity,
  DrillStatus,
} from '../model/agendas.enums';
import type {
  Agenda,
  AgendaBlock,
  AgendaGroup,
  AgendaStation,
  Drill,
} from '../model/agendas.types';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import {
  buildAgendaAudit,
  buildAgendaChildAudit,
  buildAgendaEvent,
  buildAgendaLifecycleWrite,
  buildBlockCompletion,
  buildBlockUpdate,
  buildDrillAudit,
  buildDrillUpdate,
  buildNewAgenda,
  buildNewBlock,
  buildNewDrill,
  buildNewGroup,
  buildNewGroupMember,
  buildNewStation,
  toBlockCommand,
  toGroupCommand,
  toStationCommand,
} from './agendas.builders';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function drill(): Drill {
  return {
    id: 'drill-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    name: 'Give and go',
    category: DrillCategory.Offense,
    objective: 'flow',
    instructions: 'cut hard',
    equipment: ['cones'],
    intensity: DrillIntensity.High,
    defaultDurationMinutes: 15,
    skillTags: ['cutting'],
    safetyNotes: null,
    mediaUrl: null,
    status: DrillStatus.Active,
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function agenda(): Agenda {
  return {
    id: 'agenda-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    status: AgendaStatus.Draft,
    theme: 'defense',
    notes: null,
    publishedAt: null,
    publishedBy: null,
    completedAt: null,
    completedBy: null,
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 2,
  };
}

function session(): PracticeSession {
  return {
    id: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    scheduleId: null,
    occurrenceDate: null,
    sessionType: 'practice',
    timezone: 'Africa/Cairo',
    venueId: null,
    field: null,
    capacity: null,
    meetAt: null,
    startsAt: NOW,
    endsAt: NOW,
    rsvpCutoffAt: null,
    visibility: SessionVisibility.Team,
    organizerUserId: null,
    notes: null,
    status: SessionStatus.Draft,
    cancellationReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function block(): AgendaBlock {
  return {
    id: 'block-1',
    agendaId: 'agenda-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    drillId: 'drill-1',
    position: 0,
    title: 'Warm up',
    blockType: AgendaBlockType.Warmup,
    offsetMinutes: 0,
    durationMinutes: 10,
    intensity: DrillIntensity.Low,
    repetitions: null,
    target: null,
    completionStatus: CompletionStatus.Planned,
    completedAt: null,
    completedBy: null,
    notes: 'shared',
    coachNotes: 'private',
    version: 1,
  };
}

function group(): AgendaGroup {
  return {
    id: 'group-1',
    agendaId: 'agenda-1',
    teamId: 'team-1',
    name: 'A',
    color: 'red',
    coachMembershipId: 'm-coach',
    position: 0,
    notes: null,
    version: 1,
  };
}

function station(): AgendaStation {
  return {
    id: 'station-1',
    blockId: 'block-1',
    agendaId: 'agenda-1',
    teamId: 'team-1',
    drillId: 'drill-1',
    groupId: 'group-1',
    coachMembershipId: 'm-coach',
    position: 0,
    name: 'Endzone',
    repetitions: 5,
    target: '10 completions',
    notes: null,
    completionStatus: CompletionStatus.Planned,
    version: 1,
  };
}

describe('agendas.builders', () => {
  it('builds a new drill and a version-guarded update', () => {
    const command = {
      seasonId: 'season-1',
      name: 'X',
      category: DrillCategory.Defense,
      objective: null,
      instructions: null,
      equipment: [],
      intensity: DrillIntensity.Moderate,
      defaultDurationMinutes: null,
      skillTags: [],
      safetyNotes: null,
      mediaUrl: null,
    };
    expect(
      buildNewDrill('d1', 'team-1', command, 'coach-1', NOW),
    ).toMatchObject({
      id: 'd1',
      teamId: 'team-1',
      createdBy: 'coach-1',
      now: NOW,
    });
    expect(
      buildDrillUpdate(
        'd1',
        { ...command, expectedVersion: 3 },
        'coach-1',
        NOW,
      ),
    ).toMatchObject({ id: 'd1', updatedBy: 'coach-1', expectedVersion: 3 });
  });

  it('builds a drill audit carrying only scalars', () => {
    const audit = buildDrillAudit(DRILL_CREATED_ACTION, drill(), 'coach-1');
    expect(audit.outcome).toBe(AuditOutcome.Success);
    expect(audit.diff).toEqual({
      category: DrillCategory.Offense,
      intensity: DrillIntensity.High,
      status: DrillStatus.Active,
    });
  });

  it('builds agenda row, lifecycle write, audit, and event', () => {
    expect(
      buildNewAgenda('a1', session(), { theme: 't', notes: null }, 'c', NOW),
    ).toMatchObject({ id: 'a1', sessionId: 'ses-1', teamId: 'team-1' });
    expect(buildAgendaLifecycleWrite('a1', 'c', 4, NOW)).toEqual({
      id: 'a1',
      actorUserId: 'c',
      expectedVersion: 4,
      now: NOW,
    });
    expect(
      buildAgendaAudit('act', agenda(), 'c', { status: 'draft' }).diff,
    ).toEqual({ status: 'draft' });
    expect(
      buildAgendaChildAudit(
        'act',
        BLOCK_RESOURCE_TYPE,
        'block-1',
        agenda(),
        'c',
        {
          x: 1,
        },
      ).resourceId,
    ).toBe('block-1');
    expect(
      buildAgendaEvent(AGENDA_PUBLISHED_EVENT, agenda(), 'c', { n: 1 }),
    ).toMatchObject({
      eventType: AGENDA_PUBLISHED_EVENT,
      aggregateId: 'agenda-1',
    });
  });

  it('builds block insert and update writes', () => {
    const command = toBlockCommand(block());
    expect(buildNewBlock('b1', agenda(), 2, command, 'c', NOW)).toMatchObject({
      id: 'b1',
      position: 2,
      agendaId: 'agenda-1',
      coachNotes: 'private',
    });
    expect(
      buildBlockUpdate('b1', { ...command, expectedVersion: 1 }, 'c', NOW)
        .expectedVersion,
    ).toBe(1);
  });

  it('stamps a completion instant only when executed', () => {
    const done = buildBlockCompletion(
      'b1',
      { completionStatus: CompletionStatus.Completed, expectedVersion: 1 },
      'c',
      NOW,
    );
    expect(done.completedAt).toBe(NOW);
    expect(done.completedBy).toBe('c');
    const planned = buildBlockCompletion(
      'b1',
      { completionStatus: CompletionStatus.Planned, expectedVersion: null },
      'c',
      NOW,
    );
    expect(planned.completedAt).toBeNull();
    expect(planned.completedBy).toBeNull();
  });

  it('builds station, group, and member rows', () => {
    expect(
      buildNewStation('s1', block(), 1, toStationCommand(station(), 'g2'), NOW),
    ).toMatchObject({
      id: 's1',
      blockId: 'block-1',
      groupId: 'g2',
      position: 1,
    });
    expect(
      buildNewGroup('g1', agenda(), 3, toGroupCommand(group()), NOW),
    ).toMatchObject({ id: 'g1', agendaId: 'agenda-1', name: 'A', position: 3 });
    expect(buildNewGroupMember('gm1', group(), 'm-9', NOW)).toEqual({
      id: 'gm1',
      groupId: 'group-1',
      agendaId: 'agenda-1',
      membershipId: 'm-9',
      now: NOW,
    });
  });
});
