import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { SelectionNotFoundError } from '../errors/selection-not-found.error';
import { SquadLockedError } from '../errors/squad-locked.error';
import { SquadSelectionRepository } from '../infrastructure/squad-selection.repository';
import {
  SelectionRole,
  SelectionStatus,
  SquadStatus,
} from '../model/squads.enums';
import type { Squad, SquadSelection } from '../model/squads.types';
import { RemoveSelectionUseCase } from './remove-selection.use-case';
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
    status: SquadStatus.Published,
    attendanceThresholdPct: 70,
    policyVersion: 'eligibility-signals-v1',
    selectionDeadline: null,
    notes: null,
    revision: 1,
    recordVersion: 1,
    createdBy: 'user-1',
    publishedBy: 'user-1',
    publishedAt: NOW,
    lockedAt: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function removed(): SquadSelection {
  return {
    selectionId: 'sel-1',
    squadId: 'squad-1',
    teamId: 'team-1',
    membershipId: 'm-1',
    selectionRole: SelectionRole.Player,
    status: SelectionStatus.Removed,
    reason: 'cut',
    eligibilityOverridden: false,
    overrideReason: null,
    overriddenBy: null,
    eligibilitySnapshot: 'passed',
    selectedBy: 'user-2',
    removedBy: 'user-2',
    removedAt: NOW,
    recordVersion: 2,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(
  existing: Squad,
  removalResult: SquadSelection | null,
): {
  useCase: RemoveSelectionUseCase;
  selections: {
    softRemove: ReturnType<typeof vi.fn>;
    appendEvent: ReturnType<typeof vi.fn>;
  };
} {
  const lookup = {
    require: vi.fn().mockResolvedValue(existing),
  } as unknown as SquadLookupService;
  const selections = {
    softRemove: vi.fn().mockResolvedValue(removalResult),
    appendEvent: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new RemoveSelectionUseCase(
    UOW,
    CLOCK,
    ID_GEN,
    lookup,
    selections as unknown as SquadSelectionRepository,
    audit as unknown as AuditRecorderService,
  );
  return { useCase, selections };
}

describe('RemoveSelectionUseCase', () => {
  it('soft-removes an active selection and records a removed event', async () => {
    const { useCase, selections } = build(squad(), removed());
    const result = await useCase.execute(ACTOR, 'team-1', 'squad-1', {
      membershipId: 'm-1',
      reason: 'cut',
    });
    expect(result.status).toBe(SelectionStatus.Removed);
    expect(selections.appendEvent.mock.calls[0]?.[1].eventType).toBe('removed');
  });

  it('raises not-found when the player is not currently selected', async () => {
    const { useCase } = build(squad(), null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'squad-1', {
        membershipId: 'm-1',
        reason: null,
      }),
    ).rejects.toBeInstanceOf(SelectionNotFoundError);
  });

  it('refuses removal on a locked squad', async () => {
    const { useCase } = build(squad({ status: SquadStatus.Locked }), removed());
    await expect(
      useCase.execute(ACTOR, 'team-1', 'squad-1', {
        membershipId: 'm-1',
        reason: null,
      }),
    ).rejects.toBeInstanceOf(SquadLockedError);
  });
});
