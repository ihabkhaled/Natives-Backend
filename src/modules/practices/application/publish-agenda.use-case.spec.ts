import { describe, expect, it, vi } from 'vitest';

import { InvalidAgendaTransitionError } from '../errors/invalid-agenda-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { AGENDA_PUBLISHED_EVENT } from '../model/agendas.constants';
import { AgendaStatus } from '../model/agendas.enums';
import type { Agenda } from '../model/agendas.types';
import { PublishAgendaUseCase } from './publish-agenda.use-case';

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
    publishedAt: status === AgendaStatus.Published ? NOW : null,
    publishedBy: null,
    completedAt: null,
    completedBy: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: status === AgendaStatus.Published ? 2 : 1,
  };
}

function build(current: AgendaStatus) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const lookup = {
    requireAgenda: vi.fn().mockResolvedValue(agenda(current)),
  };
  const agendas = {
    publish: vi.fn().mockResolvedValue(agenda(AgendaStatus.Published)),
  };
  const blocks = { listIdsByAgenda: vi.fn().mockResolvedValue(['b1', 'b2']) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new PublishAgendaUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    agendas as never,
    blocks as never,
    audit as never,
    events as never,
  );
  return { useCase, agendas, audit, events };
}

describe('PublishAgendaUseCase', () => {
  it('publishes a draft agenda and emits the published event', async () => {
    const h = build(AgendaStatus.Draft);
    const view = await h.useCase.execute(ACTOR, 'team-1', 'ses-1', {
      expectedVersion: 1,
    });
    expect(view.status).toBe(AgendaStatus.Published);
    expect(h.audit.record).toHaveBeenCalledOnce();
    expect(h.events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: AGENDA_PUBLISHED_EVENT,
      payload: { blockCount: 2 },
    });
  });

  it('rejects publishing a non-draft agenda', async () => {
    const h = build(AgendaStatus.Published);
    await expect(
      h.useCase.execute(ACTOR, 'team-1', 'ses-1', { expectedVersion: 2 }),
    ).rejects.toBeInstanceOf(InvalidAgendaTransitionError);
    expect(h.agendas.publish).not.toHaveBeenCalled();
  });

  it('maps a lost publish race to a version conflict', async () => {
    const h = build(AgendaStatus.Draft);
    h.agendas.publish.mockResolvedValue(null);
    await expect(
      h.useCase.execute(ACTOR, 'team-1', 'ses-1', { expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
