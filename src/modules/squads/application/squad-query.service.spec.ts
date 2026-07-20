import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { SquadRepository } from '../infrastructure/squad.repository';
import { SquadStatus } from '../model/squads.enums';
import type { Squad } from '../model/squads.types';
import { SquadLookupService } from './squad-lookup.service';
import { SquadQueryService } from './squad-query.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const NOW = new Date('2026-02-01T12:00:00.000Z');

const UOW: UnitOfWorkPort = {
  runInTransaction: op => op(TX),
};

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

describe('SquadQueryService', () => {
  it('returns a bounded page of squads with a total', async () => {
    const repo = {
      listForScope: vi.fn().mockResolvedValue([squad()]),
      countForScope: vi.fn().mockResolvedValue(1),
    } as unknown as SquadRepository;
    const service = new SquadQueryService(
      UOW,
      repo,
      new SquadLookupService(repo),
    );
    const page = await service.listForScope('team-1', 'season-1', {
      limit: 20,
      offset: 0,
    });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.limit).toBe(20);
  });

  it('resolves a single squad through the lookup', async () => {
    const repo = {
      findForWrite: vi.fn().mockResolvedValue(squad()),
    } as unknown as SquadRepository;
    const service = new SquadQueryService(
      UOW,
      repo,
      new SquadLookupService(repo),
    );
    expect((await service.getById('team-1', 'squad-1')).squadId).toBe(
      'squad-1',
    );
  });
});
