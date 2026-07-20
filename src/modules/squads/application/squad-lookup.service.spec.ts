import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { SquadNotFoundError } from '../errors/squad-not-found.error';
import { SquadRepository } from '../infrastructure/squad.repository';
import { SquadStatus } from '../model/squads.enums';
import type { Squad } from '../model/squads.types';
import { SquadLookupService } from './squad-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const NOW = new Date('2026-02-01T12:00:00.000Z');

function squad(): Squad {
  return {
    squadId: 'squad-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: null,
    name: 'Squad',
    status: SquadStatus.Draft,
    attendanceThresholdPct: 70,
    policyVersion: 'eligibility-signals-v1',
    selectionDeadline: null,
    notes: null,
    revision: 1,
    recordVersion: 1,
    createdBy: 'user-1',
    publishedBy: null,
    publishedAt: null,
    lockedAt: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('SquadLookupService', () => {
  it('returns the squad when found', async () => {
    const repo = {
      findForWrite: vi.fn().mockResolvedValue(squad()),
    } as unknown as SquadRepository;
    const service = new SquadLookupService(repo);
    expect((await service.require(TX, 'team-1', 'squad-1')).squadId).toBe(
      'squad-1',
    );
  });

  it('throws a 404 that hides existence when missing', async () => {
    const repo = {
      findForWrite: vi.fn().mockResolvedValue(null),
    } as unknown as SquadRepository;
    const service = new SquadLookupService(repo);
    await expect(
      service.require(TX, 'team-1', 'squad-1'),
    ).rejects.toBeInstanceOf(SquadNotFoundError);
  });
});
