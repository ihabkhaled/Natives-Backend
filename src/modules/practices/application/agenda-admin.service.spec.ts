import { describe, expect, it, vi } from 'vitest';

import { AgendaNotFoundError } from '../errors/agenda-not-found.error';
import { AgendaStatus } from '../model/agendas.enums';
import type { Agenda } from '../model/agendas.types';
import { AgendaAdminService } from './agenda-admin.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };

function agenda(): Agenda {
  return {
    id: 'agenda-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: null,
    status: AgendaStatus.Draft,
    theme: 't',
    notes: null,
    publishedAt: null,
    publishedBy: null,
    completedAt: null,
    completedBy: null,
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('agenda-1') };
  const sessions = {
    requireSession: vi
      .fn()
      .mockResolvedValue({ id: 'ses-1', teamId: 'team-1', seasonId: null }),
  };
  const agendas = {
    insertAgenda: vi.fn().mockResolvedValue(agenda()),
    findBySession: vi.fn().mockResolvedValue(agenda()),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new AgendaAdminService(
    unitOfWork as never,
    clock,
    idGenerator,
    sessions as never,
    agendas as never,
    audit as never,
  );
  return { service, agendas, audit };
}

describe('AgendaAdminService', () => {
  it('creates a fresh agenda and audits it', async () => {
    const h = build();
    const view = await h.service.createAgenda(ACTOR, 'team-1', 'ses-1', {
      theme: 't',
      notes: null,
    });
    expect(view.agendaId).toBe('agenda-1');
    expect(h.audit.record).toHaveBeenCalledOnce();
  });

  it('is idempotent: returns the existing agenda without re-auditing', async () => {
    const h = build();
    h.agendas.insertAgenda.mockResolvedValue(null);
    const view = await h.service.createAgenda(ACTOR, 'team-1', 'ses-1', {
      theme: null,
      notes: null,
    });
    expect(view.agendaId).toBe('agenda-1');
    expect(h.audit.record).not.toHaveBeenCalled();
  });

  it('errors if an existing agenda cannot be reloaded', async () => {
    const h = build();
    h.agendas.insertAgenda.mockResolvedValue(null);
    h.agendas.findBySession.mockResolvedValue(null);
    await expect(
      h.service.createAgenda(ACTOR, 'team-1', 'ses-1', {
        theme: null,
        notes: null,
      }),
    ).rejects.toBeInstanceOf(AgendaNotFoundError);
  });
});
