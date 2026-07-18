import { describe, expect, it, vi } from 'vitest';

import { DrillNotFoundError } from '../errors/drill-not-found.error';
import { InvalidAgendaTransitionError } from '../errors/invalid-agenda-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import {
  AgendaBlockType,
  AgendaStatus,
  CompletionStatus,
} from '../model/agendas.enums';
import type { Agenda, AgendaBlock } from '../model/agendas.types';
import { AgendaBlockService } from './agenda-block.service';

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

function block(): AgendaBlock {
  return {
    id: 'block-1',
    agendaId: 'agenda-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    drillId: null,
    position: 0,
    title: 'Warm up',
    blockType: AgendaBlockType.Warmup,
    offsetMinutes: null,
    durationMinutes: null,
    intensity: null,
    repetitions: null,
    target: null,
    completionStatus: CompletionStatus.Planned,
    completedAt: null,
    completedBy: null,
    notes: null,
    coachNotes: 'private',
    version: 1,
  };
}

function command() {
  return {
    drillId: null,
    title: 'Warm up',
    blockType: AgendaBlockType.Warmup,
    offsetMinutes: null,
    durationMinutes: null,
    intensity: null,
    repetitions: null,
    target: null,
    notes: null,
    coachNotes: 'private',
  };
}

function build(status: AgendaStatus = AgendaStatus.Draft) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('block-1') };
  const lookup = {
    requireDraft: vi.fn().mockResolvedValue(agenda(AgendaStatus.Draft)),
    requireAgenda: vi.fn().mockResolvedValue(agenda(status)),
    requireBlock: vi.fn().mockResolvedValue(block()),
  };
  const blocks = {
    nextPosition: vi.fn().mockResolvedValue(0),
    insert: vi.fn().mockResolvedValue(block()),
    update: vi.fn().mockResolvedValue(block()),
    complete: vi.fn().mockResolvedValue({
      ...block(),
      completionStatus: CompletionStatus.Completed,
    }),
    remove: vi.fn().mockResolvedValue(true),
  };
  const agendas = { bumpVersion: vi.fn().mockResolvedValue(agenda(status)) };
  const drills = {
    findByIdInTeam: vi.fn().mockResolvedValue({ id: 'drill-1' }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new AgendaBlockService(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    blocks as never,
    agendas as never,
    drills as never,
    audit as never,
  );
  return { service, lookup, blocks, drills, agendas };
}

describe('AgendaBlockService', () => {
  it('adds a block, bumps the agenda, and echoes coach notes', async () => {
    const h = build();
    const view = await h.service.addBlock(ACTOR, 'team-1', 'ses-1', command());
    expect(view.id).toBe('block-1');
    expect(view.coachNotes).toBe('private');
    expect(h.agendas.bumpVersion).toHaveBeenCalled();
  });

  it('validates a referenced drill exists in team scope', async () => {
    const h = build();
    h.drills.findByIdInTeam.mockResolvedValue(null);
    await expect(
      h.service.addBlock(ACTOR, 'team-1', 'ses-1', {
        ...command(),
        drillId: 'missing',
      }),
    ).rejects.toBeInstanceOf(DrillNotFoundError);
  });

  it('updates a block under an optimistic guard', async () => {
    const h = build();
    const view = await h.service.updateBlock(
      ACTOR,
      'team-1',
      'ses-1',
      'block-1',
      {
        ...command(),
        expectedVersion: 1,
      },
    );
    expect(view.id).toBe('block-1');
    h.blocks.update.mockResolvedValue(null);
    await expect(
      h.service.updateBlock(ACTOR, 'team-1', 'ses-1', 'block-1', {
        ...command(),
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('removes a block from a draft agenda', async () => {
    const h = build();
    await h.service.removeBlock(ACTOR, 'team-1', 'ses-1', 'block-1');
    expect(h.blocks.remove).toHaveBeenCalledWith(SCOPE, 'agenda-1', 'block-1');
  });

  it('records completion only once the agenda is published', async () => {
    const published = build(AgendaStatus.Published);
    const view = await published.service.completeBlock(
      ACTOR,
      'team-1',
      'ses-1',
      'block-1',
      { completionStatus: CompletionStatus.Completed, expectedVersion: 1 },
    );
    expect(view.completionStatus).toBe(CompletionStatus.Completed);

    const draft = build(AgendaStatus.Draft);
    await expect(
      draft.service.completeBlock(ACTOR, 'team-1', 'ses-1', 'block-1', {
        completionStatus: CompletionStatus.Completed,
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(InvalidAgendaTransitionError);
  });

  it('maps a lost completion race to a version conflict', async () => {
    const h = build(AgendaStatus.Published);
    h.blocks.complete.mockResolvedValue(null);
    await expect(
      h.service.completeBlock(ACTOR, 'team-1', 'ses-1', 'block-1', {
        completionStatus: CompletionStatus.Skipped,
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
