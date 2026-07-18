import { describe, expect, it, vi } from 'vitest';

import { AgendaLockedError } from '../errors/agenda-locked.error';
import { AgendaNotFoundError } from '../errors/agenda-not-found.error';
import { AgendaStatus } from '../model/agendas.enums';
import type { Agenda } from '../model/agendas.types';
import { CopyAgendaUseCase } from './copy-agenda.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };

function agenda(id: string, status: AgendaStatus): Agenda {
  return {
    id,
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: null,
    status,
    theme: 'defense',
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

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('new-id') };
  const sessions = {
    requireSession: vi
      .fn()
      .mockResolvedValue({ id: 'tgt-ses', teamId: 'team-1', seasonId: null }),
  };
  const agendas = {
    insertAgenda: vi
      .fn()
      .mockResolvedValue(agenda('tgt-agenda', AgendaStatus.Draft)),
    findBySession: vi
      .fn()
      .mockResolvedValue(agenda('src-agenda', AgendaStatus.Draft)),
  };
  const blocks = {
    listByAgenda: vi
      .fn()
      .mockResolvedValue([{ id: 'src-block', position: 0, drillId: null }]),
    listIdsByAgenda: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue({
      id: 'new-block',
      agendaId: 'tgt-agenda',
      teamId: 'team-1',
    }),
  };
  const stations = {
    listByAgenda: vi.fn().mockResolvedValue([
      { id: 's1', blockId: 'src-block', groupId: 'src-group', position: 0 },
      { id: 's2', blockId: 'src-block', groupId: null, position: 1 },
      { id: 's3', blockId: 'ghost', groupId: null, position: 0 },
    ]),
    insert: vi.fn().mockResolvedValue({ id: 'new-station' }),
  };
  const groups = {
    listGroupsByAgenda: vi
      .fn()
      .mockResolvedValue([{ id: 'src-group', position: 0, name: 'A' }]),
    insertGroup: vi
      .fn()
      .mockResolvedValue({ id: 'new-group', agendaId: 'tgt-agenda' }),
    listMembersByAgenda: vi.fn().mockResolvedValue([
      { id: 'm1', groupId: 'src-group', membershipId: 'p-1' },
      { id: 'm2', groupId: 'ghost', membershipId: 'p-2' },
    ]),
    addMember: vi.fn().mockResolvedValue({ membershipId: 'p-1' }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CopyAgendaUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    sessions as never,
    agendas as never,
    blocks as never,
    stations as never,
    groups as never,
    audit as never,
  );
  return { useCase, agendas, blocks, stations, groups };
}

describe('CopyAgendaUseCase', () => {
  it('copies the whole plan into a fresh agenda with new ids', async () => {
    const h = build();
    const view = await h.useCase.execute(ACTOR, 'team-1', 'tgt-ses', {
      sourceSessionId: 'src-ses',
    });
    expect(view.agendaId).toBe('tgt-agenda');
    expect(h.groups.insertGroup).toHaveBeenCalledOnce();
    expect(h.blocks.insert).toHaveBeenCalledOnce();
    // two stations copied (mapped block+group), one skipped (unknown block)
    expect(h.stations.insert).toHaveBeenCalledTimes(2);
    // one member copied, one skipped (unknown group)
    expect(h.groups.addMember).toHaveBeenCalledOnce();
  });

  it('rejects when the source session has no agenda', async () => {
    const h = build();
    h.agendas.findBySession.mockResolvedValue(null);
    await expect(
      h.useCase.execute(ACTOR, 'team-1', 'tgt-ses', {
        sourceSessionId: 'src-ses',
      }),
    ).rejects.toBeInstanceOf(AgendaNotFoundError);
  });

  it('copies into an existing empty draft agenda', async () => {
    const h = build();
    h.agendas.insertAgenda.mockResolvedValue(null);
    const view = await h.useCase.execute(ACTOR, 'team-1', 'tgt-ses', {
      sourceSessionId: 'src-ses',
    });
    expect(view.agendaId).toBe('src-agenda');
  });

  it('refuses to copy over a published or non-empty target', async () => {
    const published = build();
    published.agendas.insertAgenda.mockResolvedValue(null);
    published.agendas.findBySession.mockResolvedValue(
      agenda('tgt-agenda', AgendaStatus.Published),
    );
    await expect(
      published.useCase.execute(ACTOR, 'team-1', 'tgt-ses', {
        sourceSessionId: 'src-ses',
      }),
    ).rejects.toBeInstanceOf(AgendaLockedError);

    const nonEmpty = build();
    nonEmpty.agendas.insertAgenda.mockResolvedValue(null);
    nonEmpty.blocks.listIdsByAgenda.mockResolvedValue(['existing']);
    await expect(
      nonEmpty.useCase.execute(ACTOR, 'team-1', 'tgt-ses', {
        sourceSessionId: 'src-ses',
      }),
    ).rejects.toBeInstanceOf(AgendaLockedError);
  });
});
