import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { SquadRepository } from '../infrastructure/squad.repository';
import { SquadEligibilityRepository } from '../infrastructure/squad-eligibility.repository';
import {
  AvailabilityStatus,
  CandidateStatus,
  SignalStatus,
  SquadStatus,
} from '../model/squads.enums';
import type { EligibilityInputs, Squad } from '../model/squads.types';
import { EligibilityReportService } from './eligibility-report.service';
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

function inputs(overrides: Partial<EligibilityInputs> = {}): EligibilityInputs {
  return {
    membershipId: 'm-1',
    fullName: 'Player One',
    status: CandidateStatus.Active,
    registeredInSeason: true,
    gender: 'man',
    jerseyNumber: 7,
    attendedSessions: 3,
    eligibleSessions: 10,
    injuredSessions: 0,
    availability: AvailabilityStatus.Available,
    selected: false,
    selectionOverridden: false,
    ...overrides,
  };
}

describe('EligibilityReportService', () => {
  it('computes advisory signals and the selected gender ratio', async () => {
    const eligibility = {
      listCandidates: vi.fn().mockResolvedValue([inputs()]),
      countCandidates: vi.fn().mockResolvedValue(1),
      genderCountsForSelected: vi.fn().mockResolvedValue([
        { gender: 'man', count: 2 },
        { gender: 'woman', count: 2 },
      ]),
    } as unknown as SquadEligibilityRepository;
    const repo = {
      findForWrite: vi.fn().mockResolvedValue(squad()),
    } as unknown as SquadRepository;
    const service = new EligibilityReportService(
      UOW,
      new SquadLookupService(repo),
      eligibility,
    );
    const report = await service.report('team-1', 'squad-1', {
      limit: 100,
      offset: 0,
    });
    expect(report.policyVersion).toBe('eligibility-signals-v1');
    expect(report.candidates).toHaveLength(1);
    expect(report.candidates[0]?.overall).toBe(SignalStatus.Warning);
    expect(report.candidates[0]?.attendancePct).toBe(30);
    expect(report.selectedGenderRatio.balanced).toBe(true);
    expect(report.total).toBe(1);
  });
});
