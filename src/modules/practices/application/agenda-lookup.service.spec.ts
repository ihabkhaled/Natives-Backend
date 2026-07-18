import { describe, expect, it, vi } from 'vitest';

import { AgendaBlockNotFoundError } from '../errors/agenda-block-not-found.error';
import { AgendaGroupNotFoundError } from '../errors/agenda-group-not-found.error';
import { AgendaLockedError } from '../errors/agenda-locked.error';
import { AgendaNotFoundError } from '../errors/agenda-not-found.error';
import { AgendaStatus } from '../model/agendas.enums';
import type { Agenda } from '../model/agendas.types';
import { AgendaLookupService } from './agenda-lookup.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;

function agenda(status: AgendaStatus = AgendaStatus.Draft): Agenda {
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

function build() {
  const sessions = {
    requireSession: vi.fn().mockResolvedValue({ id: 'ses-1' }),
  };
  const agendas = { findBySession: vi.fn().mockResolvedValue(agenda()) };
  const blocks = {
    findByIdInAgenda: vi.fn().mockResolvedValue({ id: 'block-1' }),
  };
  const groups = {
    findGroupByIdInAgenda: vi.fn().mockResolvedValue({ id: 'group-1' }),
  };
  const service = new AgendaLookupService(
    sessions as never,
    agendas as never,
    blocks as never,
    groups as never,
  );
  return { service, sessions, agendas, blocks, groups };
}

describe('AgendaLookupService', () => {
  it('resolves an existing agenda within team scope', async () => {
    const h = build();
    expect((await h.service.requireAgenda(SCOPE, 'team-1', 'ses-1')).id).toBe(
      'agenda-1',
    );
    h.agendas.findBySession.mockResolvedValue(null);
    await expect(
      h.service.requireAgenda(SCOPE, 'team-1', 'ses-1'),
    ).rejects.toBeInstanceOf(AgendaNotFoundError);
  });

  it('enforces the publish lock via requireEditable/requireDraft', async () => {
    const h = build();
    expect(() => h.service.requireEditable(agenda())).not.toThrow();
    expect(() =>
      h.service.requireEditable(agenda(AgendaStatus.Published)),
    ).toThrow(AgendaLockedError);

    expect((await h.service.requireDraft(SCOPE, 'team-1', 'ses-1')).id).toBe(
      'agenda-1',
    );
    h.agendas.findBySession.mockResolvedValue(agenda(AgendaStatus.Published));
    await expect(
      h.service.requireDraft(SCOPE, 'team-1', 'ses-1'),
    ).rejects.toBeInstanceOf(AgendaLockedError);
  });

  it('resolves or 404s a block and a group', async () => {
    const h = build();
    expect(
      (await h.service.requireBlock(SCOPE, 'agenda-1', 'block-1')).id,
    ).toBe('block-1');
    h.blocks.findByIdInAgenda.mockResolvedValue(null);
    await expect(
      h.service.requireBlock(SCOPE, 'agenda-1', 'x'),
    ).rejects.toBeInstanceOf(AgendaBlockNotFoundError);

    expect(
      (await h.service.requireGroup(SCOPE, 'agenda-1', 'group-1')).id,
    ).toBe('group-1');
    h.groups.findGroupByIdInAgenda.mockResolvedValue(null);
    await expect(
      h.service.requireGroup(SCOPE, 'agenda-1', 'x'),
    ).rejects.toBeInstanceOf(AgendaGroupNotFoundError);
  });
});
