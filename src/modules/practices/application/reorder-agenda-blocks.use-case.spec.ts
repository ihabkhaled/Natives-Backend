import { describe, expect, it, vi } from 'vitest';

import { AgendaLockedError } from '../errors/agenda-locked.error';
import { InvalidReorderError } from '../errors/invalid-reorder.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { AgendaStatus } from '../model/agendas.enums';
import type { Agenda } from '../model/agendas.types';
import { ReorderAgendaBlocksUseCase } from './reorder-agenda-blocks.use-case';

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
    version: 3,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const lookup = {
    requireAgenda: vi.fn().mockResolvedValue(agenda()),
    requireEditable: vi.fn(),
  };
  const agendas = {
    bumpVersion: vi.fn().mockResolvedValue({ ...agenda(), version: 4 }),
  };
  const blocks = {
    listIdsByAgenda: vi.fn().mockResolvedValue(['a', 'b', 'c']),
    reposition: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new ReorderAgendaBlocksUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    agendas as never,
    blocks as never,
    audit as never,
  );
  return { useCase, lookup, agendas, blocks };
}

describe('ReorderAgendaBlocksUseCase', () => {
  it('reorders a valid permutation atomically and bumps the version', async () => {
    const h = build();
    const view = await h.useCase.execute(ACTOR, 'team-1', 'ses-1', {
      blockIds: ['c', 'a', 'b'],
      expectedVersion: 3,
    });
    expect(view.version).toBe(4);
    expect(h.blocks.reposition.mock.calls[0]?.[2]).toEqual([
      { id: 'c', position: 0 },
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
    ]);
  });

  it('rejects a reorder that is not a permutation of current blocks', async () => {
    const h = build();
    await expect(
      h.useCase.execute(ACTOR, 'team-1', 'ses-1', {
        blockIds: ['a', 'b'],
        expectedVersion: 3,
      }),
    ).rejects.toBeInstanceOf(InvalidReorderError);
    expect(h.agendas.bumpVersion).not.toHaveBeenCalled();
  });

  it('maps a lost reorder race to a version conflict', async () => {
    const h = build();
    h.agendas.bumpVersion.mockResolvedValue(null);
    await expect(
      h.useCase.execute(ACTOR, 'team-1', 'ses-1', {
        blockIds: ['a', 'b', 'c'],
        expectedVersion: 3,
      }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
    expect(h.blocks.reposition).not.toHaveBeenCalled();
  });

  it('refuses to reorder a published (locked) agenda', async () => {
    const h = build();
    h.lookup.requireEditable.mockImplementation(() => {
      throw new AgendaLockedError();
    });
    await expect(
      h.useCase.execute(ACTOR, 'team-1', 'ses-1', {
        blockIds: ['a', 'b', 'c'],
        expectedVersion: 3,
      }),
    ).rejects.toBeInstanceOf(AgendaLockedError);
  });
});
