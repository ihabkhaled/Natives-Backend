import { describe, expect, it, vi } from 'vitest';

import { InvalidAgendaTransitionError } from '../errors/invalid-agenda-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { AGENDA_COMPLETED_EVENT } from '../model/agendas.constants';
import { AgendaStatus } from '../model/agendas.enums';
import type { Agenda } from '../model/agendas.types';
import { CompleteAgendaUseCase } from './complete-agenda.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };

function agenda(status: AgendaStatus): Agenda {
  return {
    id: 'agenda-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: null,
    status,
    theme: null,
    notes: null,
    publishedAt: NOW,
    publishedBy: null,
    completedAt: status === AgendaStatus.Completed ? NOW : null,
    completedBy: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 2,
  };
}

function build(current: AgendaStatus) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const lookup = { requireAgenda: vi.fn().mockResolvedValue(agenda(current)) };
  const agendas = {
    complete: vi.fn().mockResolvedValue(agenda(AgendaStatus.Completed)),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CompleteAgendaUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    agendas as never,
    audit as never,
    events as never,
  );
  return { useCase, agendas, events };
}

describe('CompleteAgendaUseCase', () => {
  it('completes a published agenda and emits the completed event', async () => {
    const h = build(AgendaStatus.Published);
    const view = await h.useCase.execute(ACTOR, 'team-1', 'ses-1', {
      expectedVersion: 2,
    });
    expect(view.status).toBe(AgendaStatus.Completed);
    expect(h.events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: AGENDA_COMPLETED_EVENT,
    });
  });

  it('rejects completing a draft agenda', async () => {
    const h = build(AgendaStatus.Draft);
    await expect(
      h.useCase.execute(ACTOR, 'team-1', 'ses-1', { expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(InvalidAgendaTransitionError);
  });

  it('maps a lost complete race to a version conflict', async () => {
    const h = build(AgendaStatus.Published);
    h.agendas.complete.mockResolvedValue(null);
    await expect(
      h.useCase.execute(ACTOR, 'team-1', 'ses-1', { expectedVersion: 2 }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
