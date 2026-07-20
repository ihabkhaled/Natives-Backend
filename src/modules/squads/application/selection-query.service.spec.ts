import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { SquadRepository } from '../infrastructure/squad.repository';
import { SquadSelectionRepository } from '../infrastructure/squad-selection.repository';
import {
  SelectionRole,
  SelectionStatus,
  SquadStatus,
} from '../model/squads.enums';
import type { Squad, SquadSelection } from '../model/squads.types';
import { SelectionQueryService } from './selection-query.service';
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

function selection(): SquadSelection {
  return {
    selectionId: 'sel-1',
    squadId: 'squad-1',
    teamId: 'team-1',
    membershipId: 'm-1',
    selectionRole: SelectionRole.Player,
    status: SelectionStatus.Selected,
    reason: null,
    eligibilityOverridden: false,
    overrideReason: null,
    overriddenBy: null,
    eligibilitySnapshot: 'passed',
    selectedBy: 'user-2',
    removedBy: null,
    removedAt: null,
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('SelectionQueryService', () => {
  it('resolves the squad then returns a bounded page of selections', async () => {
    const squadRepo = {
      findForWrite: vi.fn().mockResolvedValue(squad()),
    } as unknown as SquadRepository;
    const selectionRepo = {
      listForSquad: vi.fn().mockResolvedValue([selection()]),
      countForSquad: vi.fn().mockResolvedValue(1),
    } as unknown as SquadSelectionRepository;
    const service = new SelectionQueryService(
      UOW,
      new SquadLookupService(squadRepo),
      selectionRepo,
    );
    const page = await service.listForSquad('team-1', 'squad-1', {
      limit: 20,
      offset: 0,
    });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });
});
