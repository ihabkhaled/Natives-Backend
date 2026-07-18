import { describe, expect, it, vi } from 'vitest';

import { AttendanceMembershipNotFoundError } from '../errors/attendance-membership-not-found.error';
import { AgendaStatus } from '../model/agendas.enums';
import type { Agenda, AgendaGroup } from '../model/agendas.types';
import { AgendaGroupService } from './agenda-group.service';

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

function group(): AgendaGroup {
  return {
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
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('group-1') };
  const lookup = {
    requireDraft: vi.fn().mockResolvedValue(AGENDA),
    requireGroup: vi.fn().mockResolvedValue(group()),
  };
  const groups = {
    nextPosition: vi.fn().mockResolvedValue(0),
    insertGroup: vi.fn().mockResolvedValue(group()),
    addMember: vi.fn().mockResolvedValue({ membershipId: 'm-1' }),
    removeMember: vi.fn().mockResolvedValue(true),
    removeGroup: vi.fn().mockResolvedValue(true),
    listMembersByAgenda: vi.fn().mockResolvedValue([
      {
        id: 'gm-1',
        groupId: 'group-1',
        agendaId: 'agenda-1',
        membershipId: 'm-1',
      },
    ]),
  };
  const agendas = { bumpVersion: vi.fn().mockResolvedValue(AGENDA) };
  const memberships = {
    findActiveById: vi.fn().mockResolvedValue({ id: 'm-1' }),
    findByIdInTeam: vi.fn().mockResolvedValue({ id: 'm-1' }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new AgendaGroupService(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    groups as never,
    agendas as never,
    memberships as never,
    audit as never,
  );
  return { service, groups, memberships };
}

describe('AgendaGroupService', () => {
  it('creates a group with a validated coach', async () => {
    const h = build();
    const view = await h.service.createGroup(ACTOR, 'team-1', 'ses-1', {
      name: 'A',
      color: null,
      coachMembershipId: 'm-1',
      notes: null,
    });
    expect(view.id).toBe('group-1');
    expect(h.memberships.findByIdInTeam).toHaveBeenCalled();
  });

  it('rejects a missing coach membership', async () => {
    const h = build();
    h.memberships.findByIdInTeam.mockResolvedValue(null);
    await expect(
      h.service.createGroup(ACTOR, 'team-1', 'ses-1', {
        name: 'A',
        color: null,
        coachMembershipId: 'x',
        notes: null,
      }),
    ).rejects.toBeInstanceOf(AttendanceMembershipNotFoundError);
  });

  it('assigns active members and returns the group with them', async () => {
    const h = build();
    const view = await h.service.assignMembers(
      ACTOR,
      'team-1',
      'ses-1',
      'group-1',
      {
        membershipIds: ['m-1'],
      },
    );
    expect(view.members).toEqual([{ membershipId: 'm-1' }]);
    expect(h.groups.addMember).toHaveBeenCalledOnce();
  });

  it('rejects assigning a non-active member', async () => {
    const h = build();
    h.memberships.findActiveById.mockResolvedValue(null);
    await expect(
      h.service.assignMembers(ACTOR, 'team-1', 'ses-1', 'group-1', {
        membershipIds: ['x'],
      }),
    ).rejects.toBeInstanceOf(AttendanceMembershipNotFoundError);
  });

  it('removes a member and a group', async () => {
    const h = build();
    await h.service.removeMember(ACTOR, 'team-1', 'ses-1', 'group-1', 'm-1');
    expect(h.groups.removeMember).toHaveBeenCalled();
    await h.service.removeGroup(ACTOR, 'team-1', 'ses-1', 'group-1');
    expect(h.groups.removeGroup).toHaveBeenCalledWith(
      SCOPE,
      'agenda-1',
      'group-1',
    );
  });
});
