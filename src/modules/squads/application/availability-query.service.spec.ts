import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { SquadRepository } from '../infrastructure/squad.repository';
import { SquadAvailabilityRepository } from '../infrastructure/squad-availability.repository';
import {
  AvailabilitySource,
  AvailabilityStatus,
  SquadStatus,
} from '../model/squads.enums';
import type { Availability, Squad } from '../model/squads.types';
import { AvailabilityQueryService } from './availability-query.service';
import { SquadLookupService } from './squad-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const NOW = new Date('2026-02-01T12:00:00.000Z');
const UOW: UnitOfWorkPort = { runInTransaction: op => op(TX) };

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

function availability(): Availability {
  return {
    availabilityId: 'av-1',
    squadId: 'squad-1',
    teamId: 'team-1',
    membershipId: 'm-1',
    availability: AvailabilityStatus.Available,
    reason: null,
    source: AvailabilitySource.Self,
    declaredBy: 'user-1',
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('AvailabilityQueryService', () => {
  it('resolves the squad then returns a bounded page of declarations', async () => {
    const squadRepo = {
      findForWrite: vi.fn().mockResolvedValue(squad()),
    } as unknown as SquadRepository;
    const availabilityRepo = {
      listForSquad: vi.fn().mockResolvedValue([availability()]),
      countForSquad: vi.fn().mockResolvedValue(1),
    } as unknown as SquadAvailabilityRepository;
    const service = new AvailabilityQueryService(
      UOW,
      new SquadLookupService(squadRepo),
      availabilityRepo,
    );
    const page = await service.listForSquad('team-1', 'squad-1', {
      limit: 20,
      offset: 0,
    });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });
});
