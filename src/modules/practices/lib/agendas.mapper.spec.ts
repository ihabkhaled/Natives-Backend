import { describe, expect, it } from 'vitest';

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
  AgendaGroupMember,
  AgendaStation,
  Drill,
} from '../model/agendas.types';
import {
  emptyAgendaView,
  toAgendaSummaryView,
  toAgendaView,
  toDrillView,
  toListDrillsView,
} from './agendas.mapper';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function drill(): Drill {
  return {
    id: 'drill-1',
    teamId: 'team-1',
    seasonId: null,
    name: 'Break mark',
    category: DrillCategory.Offense,
    objective: 'flow',
    instructions: null,
    equipment: ['discs'],
    intensity: DrillIntensity.Moderate,
    defaultDurationMinutes: null,
    skillTags: ['throwing'],
    safetyNotes: null,
    mediaUrl: null,
    status: DrillStatus.Active,
    createdBy: null,
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
    seasonId: null,
    status: AgendaStatus.Published,
    theme: 'defense',
    notes: 'notes',
    publishedAt: NOW,
    publishedBy: 'coach-1',
    completedAt: null,
    completedBy: null,
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 3,
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

function station(): AgendaStation {
  return {
    id: 'station-1',
    blockId: 'block-1',
    agendaId: 'agenda-1',
    teamId: 'team-1',
    drillId: null,
    groupId: 'group-1',
    coachMembershipId: null,
    position: 0,
    name: 'Endzone',
    repetitions: null,
    target: null,
    notes: null,
    completionStatus: CompletionStatus.Planned,
    version: 1,
  };
}

function groupWith(members: readonly AgendaGroupMember[]): {
  group: AgendaGroup;
  members: readonly AgendaGroupMember[];
} {
  const group: AgendaGroup = {
    id: 'group-1',
    agendaId: 'agenda-1',
    teamId: 'team-1',
    name: 'A',
    color: null,
    coachMembershipId: null,
    position: 0,
    notes: null,
    version: 1,
  };
  return { group, members };
}

describe('agendas.mapper', () => {
  it('maps a drill and a paginated list', () => {
    expect(toDrillView(drill())).toMatchObject({
      id: 'drill-1',
      equipment: ['discs'],
      skillTags: ['throwing'],
    });
    expect(
      toListDrillsView({ items: [drill()], total: 1, limit: 20, offset: 0 }),
    ).toMatchObject({ total: 1, limit: 20, offset: 0 });
  });

  it('maps an agenda summary', () => {
    expect(toAgendaSummaryView(agenda())).toMatchObject({
      agendaId: 'agenda-1',
      status: AgendaStatus.Published,
      version: 3,
    });
  });

  it('returns an explicit empty view when no agenda exists', () => {
    const view = emptyAgendaView('ses-9');
    expect(view.agendaId).toBeNull();
    expect(view.blocks).toEqual([]);
    const nullTree = toAgendaView(
      'ses-9',
      null,
      { blocks: [], stations: [], groups: [], members: [] },
      true,
    );
    expect(nullTree.status).toBeNull();
  });

  it('assembles the tree and hides coach notes on the broad read', () => {
    const member: AgendaGroupMember = {
      id: 'gm-1',
      groupId: 'group-1',
      agendaId: 'agenda-1',
      membershipId: 'm-1',
    };
    const other: AgendaGroupMember = {
      id: 'gm-2',
      groupId: 'group-other',
      agendaId: 'agenda-1',
      membershipId: 'm-2',
    };
    const { group, members } = groupWith([member, other]);
    const parts = {
      blocks: [block()],
      stations: [station()],
      groups: [group],
      members,
    };
    const broad = toAgendaView('ses-1', agenda(), parts, false);
    expect(broad.blocks[0]?.coachNotes).toBeNull();
    expect(broad.blocks[0]?.stations).toHaveLength(1);
    expect(broad.groups[0]?.members).toEqual([{ membershipId: 'm-1' }]);

    const plan = toAgendaView('ses-1', agenda(), parts, true);
    expect(plan.blocks[0]?.coachNotes).toBe('private');
  });
});
