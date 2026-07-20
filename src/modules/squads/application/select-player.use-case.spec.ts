import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { CandidateNotFoundError } from '../errors/candidate-not-found.error';
import { EligibilityOverrideRequiredError } from '../errors/eligibility-override-required.error';
import { SquadLockedError } from '../errors/squad-locked.error';
import { SquadEligibilityRepository } from '../infrastructure/squad-eligibility.repository';
import { SquadSelectionRepository } from '../infrastructure/squad-selection.repository';
import {
  AvailabilityStatus,
  CandidateStatus,
  SelectionRole,
  SelectionStatus,
  SquadStatus,
} from '../model/squads.enums';
import type {
  EligibilityInputs,
  SelectPlayerCommand,
  Squad,
  SquadSelection,
} from '../model/squads.types';
import { SelectPlayerUseCase } from './select-player.use-case';
import type { SquadLookupService } from './squad-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const NOW = new Date('2026-02-01T12:00:00.000Z');
const UOW: UnitOfWorkPort = { runInTransaction: op => op(TX) };
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'gen-1' };
const ACTOR: AuthUserIdentity = {
  userId: 'user-2',
  email: 'c@x.test',
  roles: [],
};

function squad(overrides: Partial<Squad> = {}): Squad {
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
    ...overrides,
  };
}

function clearInputs(
  overrides: Partial<EligibilityInputs> = {},
): EligibilityInputs {
  return {
    membershipId: 'm-1',
    fullName: 'Player One',
    status: CandidateStatus.Active,
    registeredInSeason: true,
    gender: 'man',
    jerseyNumber: 7,
    attendedSessions: 9,
    eligibleSessions: 10,
    injuredSessions: 0,
    availability: AvailabilityStatus.Available,
    selected: false,
    selectionOverridden: false,
    ...overrides,
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

function build(
  existing: Squad,
  candidate: EligibilityInputs | null,
): {
  useCase: SelectPlayerUseCase;
  selections: {
    upsert: ReturnType<typeof vi.fn>;
    appendEvent: ReturnType<typeof vi.fn>;
  };
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const lookup = {
    require: vi.fn().mockResolvedValue(existing),
  } as unknown as SquadLookupService;
  const eligibility = {
    findCandidate: vi.fn().mockResolvedValue(candidate),
  } as unknown as SquadEligibilityRepository;
  const selections = {
    upsert: vi.fn().mockResolvedValue(selection()),
    appendEvent: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new SelectPlayerUseCase(
    UOW,
    CLOCK,
    ID_GEN,
    lookup,
    eligibility,
    selections as unknown as SquadSelectionRepository,
    audit as unknown as AuditRecorderService,
  );
  return { useCase, selections, audit };
}

function command(
  override: SelectPlayerCommand['override'] = null,
): SelectPlayerCommand {
  return {
    content: {
      membershipId: 'm-1',
      selectionRole: SelectionRole.Player,
      reason: null,
    },
    override,
  };
}

describe('SelectPlayerUseCase', () => {
  it('selects a clear candidate and records a Selected history event', async () => {
    const { useCase, selections, audit } = build(squad(), clearInputs());
    const result = await useCase.execute(ACTOR, 'team-1', 'squad-1', command());
    expect(result.membershipId).toBe('m-1');
    expect(selections.upsert).toHaveBeenCalledOnce();
    expect(selections.appendEvent.mock.calls[0]?.[1].eventType).toBe(
      'selected',
    );
    expect(audit.record.mock.calls[0]?.[1].diff.overridden).toBe(false);
  });

  it('rejects selecting a flagged candidate without an override', async () => {
    const { useCase } = build(
      squad(),
      clearInputs({ status: CandidateStatus.Suspended }),
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'squad-1', command()),
    ).rejects.toBeInstanceOf(EligibilityOverrideRequiredError);
  });

  it('selects a flagged candidate with an override and records the evidence', async () => {
    const { useCase, selections, audit } = build(
      squad(),
      clearInputs({ status: CandidateStatus.Suspended }),
    );
    await useCase.execute(
      ACTOR,
      'team-1',
      'squad-1',
      command({ overrideReason: 'coach cleared the suspension' }),
    );
    expect(selections.upsert.mock.calls[0]?.[1].eligibilityOverridden).toBe(
      true,
    );
    expect(selections.appendEvent.mock.calls[0]?.[1].eventType).toBe(
      'overridden',
    );
    expect(audit.record.mock.calls[0]?.[1].diff.overridden).toBe(true);
  });

  it('rejects a candidate who is not a member of the team and season', async () => {
    const { useCase } = build(squad(), null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'squad-1', command()),
    ).rejects.toBeInstanceOf(CandidateNotFoundError);
  });

  it('refuses selection changes on a locked squad', async () => {
    const { useCase } = build(
      squad({ status: SquadStatus.Locked }),
      clearInputs(),
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'squad-1', command()),
    ).rejects.toBeInstanceOf(SquadLockedError);
  });
});
