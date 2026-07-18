import { describe, expect, it, vi } from 'vitest';

import { AttendanceMembershipNotFoundError } from '../errors/attendance-membership-not-found.error';
import { DrillNotFoundError } from '../errors/drill-not-found.error';
import { AgendaStatus, CompletionStatus } from '../model/agendas.enums';
import type {
  Agenda,
  AgendaBlock,
  AgendaStation,
} from '../model/agendas.types';
import { AgendaStationService } from './agenda-station.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };

const AGENDA: Agenda = {
  id: 'agenda-1',
  sessionId: 'ses-1',
  teamId: 'team-1',
  seasonId: null,
  status: AgendaStatus.Draft,
  theme: null,
  notes: null,
  publishedAt: null,
  publishedBy: null,
  completedAt: null,
  completedBy: null,
  createdBy: null,
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};

const BLOCK = {
  id: 'block-1',
  agendaId: 'agenda-1',
  teamId: 'team-1',
} as AgendaBlock;

function station(): AgendaStation {
  return {
    id: 'station-1',
    blockId: 'block-1',
    agendaId: 'agenda-1',
    teamId: 'team-1',
    drillId: null,
    groupId: null,
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

function command() {
  return {
    drillId: null,
    groupId: null,
    coachMembershipId: null,
    name: 'Endzone',
    repetitions: null,
    target: null,
    notes: null,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('station-1') };
  const lookup = {
    requireDraft: vi.fn().mockResolvedValue(AGENDA),
    requireBlock: vi.fn().mockResolvedValue(BLOCK),
    requireGroup: vi.fn().mockResolvedValue({ id: 'group-1' }),
  };
  const stations = {
    nextPosition: vi.fn().mockResolvedValue(0),
    insert: vi.fn().mockResolvedValue(station()),
    remove: vi.fn().mockResolvedValue(true),
  };
  const agendas = { bumpVersion: vi.fn().mockResolvedValue(AGENDA) };
  const drills = {
    findByIdInTeam: vi.fn().mockResolvedValue({ id: 'drill-1' }),
  };
  const memberships = {
    findByIdInTeam: vi.fn().mockResolvedValue({ id: 'm-1' }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new AgendaStationService(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    stations as never,
    agendas as never,
    drills as never,
    memberships as never,
    audit as never,
  );
  return { service, lookup, stations, drills, memberships };
}

describe('AgendaStationService', () => {
  it('adds a station and bumps the agenda version', async () => {
    const h = build();
    const view = await h.service.addStation(
      ACTOR,
      'team-1',
      'ses-1',
      'block-1',
      command(),
    );
    expect(view.id).toBe('station-1');
    expect(h.stations.insert).toHaveBeenCalled();
  });

  it('validates the group and coach references', async () => {
    const h = build();
    await h.service.addStation(ACTOR, 'team-1', 'ses-1', 'block-1', {
      ...command(),
      groupId: 'group-1',
      coachMembershipId: 'm-1',
    });
    expect(h.lookup.requireGroup).toHaveBeenCalled();
    expect(h.memberships.findByIdInTeam).toHaveBeenCalled();
  });

  it('rejects a missing drill or coach membership', async () => {
    const drillGone = build();
    drillGone.drills.findByIdInTeam.mockResolvedValue(null);
    await expect(
      drillGone.service.addStation(ACTOR, 'team-1', 'ses-1', 'block-1', {
        ...command(),
        drillId: 'x',
      }),
    ).rejects.toBeInstanceOf(DrillNotFoundError);

    const coachGone = build();
    coachGone.memberships.findByIdInTeam.mockResolvedValue(null);
    await expect(
      coachGone.service.addStation(ACTOR, 'team-1', 'ses-1', 'block-1', {
        ...command(),
        coachMembershipId: 'x',
      }),
    ).rejects.toBeInstanceOf(AttendanceMembershipNotFoundError);
  });

  it('removes a station', async () => {
    const h = build();
    await h.service.removeStation(
      ACTOR,
      'team-1',
      'ses-1',
      'block-1',
      'station-1',
    );
    expect(h.stations.remove).toHaveBeenCalledWith(
      SCOPE,
      'block-1',
      'station-1',
    );
  });
});
