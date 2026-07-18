import { describe, expect, it, vi } from 'vitest';

import { AgendaStatus } from '../model/agendas.enums';
import type { Agenda } from '../model/agendas.types';
import { AgendaQueryService } from './agenda-query.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;

function agenda(): Agenda {
  return {
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
}

function block() {
  return {
    id: 'block-1',
    agendaId: 'agenda-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    drillId: null,
    position: 0,
    title: 'Warm up',
    blockType: 'warmup',
    offsetMinutes: null,
    durationMinutes: null,
    intensity: null,
    repetitions: null,
    target: null,
    completionStatus: 'planned',
    completedAt: null,
    completedBy: null,
    notes: null,
    coachNotes: 'secret',
    version: 1,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const sessions = {
    requireSession: vi.fn().mockResolvedValue({ id: 'ses-1' }),
  };
  const agendas = { findBySession: vi.fn().mockResolvedValue(agenda()) };
  const blocks = {
    listByAgenda: vi.fn().mockResolvedValue([block()]),
  };
  const stations = { listByAgenda: vi.fn().mockResolvedValue([]) };
  const groups = {
    listGroupsByAgenda: vi.fn().mockResolvedValue([]),
    listMembersByAgenda: vi.fn().mockResolvedValue([]),
  };
  const service = new AgendaQueryService(
    unitOfWork as never,
    sessions as never,
    agendas as never,
    blocks as never,
    stations as never,
    groups as never,
  );
  return { service, agendas };
}

describe('AgendaQueryService', () => {
  it('returns an explicit empty view when no agenda exists', async () => {
    const h = build();
    h.agendas.findBySession.mockResolvedValue(null);
    const view = await h.service.getAgenda('team-1', 'ses-1');
    expect(view.agendaId).toBeNull();
    expect(view.blocks).toEqual([]);
  });

  it('hides coach notes on the broad read and shows them on the plan', async () => {
    const h = build();
    const broad = await h.service.getAgenda('team-1', 'ses-1');
    expect(broad.blocks[0]?.coachNotes).toBeNull();
    const plan = await h.service.getAgendaPlan('team-1', 'ses-1');
    expect(plan.blocks[0]?.coachNotes).toBe('secret');
  });
});
