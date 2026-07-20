import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { SquadInvalidTransitionError } from '../errors/squad-invalid-transition.error';
import { SquadVersionConflictError } from '../errors/squad-version-conflict.error';
import { SquadRepository } from '../infrastructure/squad.repository';
import { SquadSelectionRepository } from '../infrastructure/squad-selection.repository';
import { SquadStatus, SquadTransition } from '../model/squads.enums';
import type { Squad } from '../model/squads.types';
import type { SquadLookupService } from './squad-lookup.service';
import { TransitionSquadUseCase } from './transition-squad.use-case';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const NOW = new Date('2026-02-01T12:00:00.000Z');
const UOW: UnitOfWorkPort = { runInTransaction: op => op(TX) };
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
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

function build(
  existing: Squad,
  changed: Squad | null,
): {
  useCase: TransitionSquadUseCase;
  events: { enqueue: ReturnType<typeof vi.fn> };
} {
  const lookup = {
    require: vi.fn().mockResolvedValue(existing),
  } as unknown as SquadLookupService;
  const repo = {
    applyStatusChange: vi.fn().mockResolvedValue(changed),
  } as unknown as SquadRepository;
  const selections = {
    countActive: vi.fn().mockResolvedValue(9),
  } as unknown as SquadSelectionRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new TransitionSquadUseCase(
    UOW,
    CLOCK,
    lookup,
    repo,
    selections,
    audit as unknown as AuditRecorderService,
    events as unknown as RecordDomainEventService,
  );
  return { useCase, events };
}

describe('TransitionSquadUseCase', () => {
  it('publishes a draft and enqueues squad.published with the selection count', async () => {
    const { useCase, events } = build(
      squad(),
      squad({ status: SquadStatus.Published }),
    );
    const result = await useCase.execute(ACTOR, 'team-1', 'squad-1', {
      transition: SquadTransition.Publish,
      expectedRecordVersion: 1,
    });
    expect(result.status).toBe(SquadStatus.Published);
    expect(events.enqueue).toHaveBeenCalledOnce();
    expect(events.enqueue.mock.calls[0]?.[1].eventType).toBe(
      'squad.published.v1',
    );
    expect(events.enqueue.mock.calls[0]?.[1].payload.selectionCount).toBe(9);
  });

  it('locks a published squad and enqueues squad.locked', async () => {
    const { useCase, events } = build(
      squad({ status: SquadStatus.Published }),
      squad({ status: SquadStatus.Locked }),
    );
    await useCase.execute(ACTOR, 'team-1', 'squad-1', {
      transition: SquadTransition.Lock,
      expectedRecordVersion: 1,
    });
    expect(events.enqueue.mock.calls[0]?.[1].eventType).toBe('squad.locked.v1');
  });

  it('revises a locked squad back to draft with no event', async () => {
    const { useCase, events } = build(
      squad({ status: SquadStatus.Locked }),
      squad({ status: SquadStatus.Draft, revision: 2 }),
    );
    const result = await useCase.execute(ACTOR, 'team-1', 'squad-1', {
      transition: SquadTransition.Revise,
      expectedRecordVersion: 1,
    });
    expect(result.status).toBe(SquadStatus.Draft);
    expect(events.enqueue).not.toHaveBeenCalled();
  });

  it('rejects an illegal transition', async () => {
    const { useCase } = build(squad(), null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'squad-1', {
        transition: SquadTransition.Lock,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(SquadInvalidTransitionError);
  });

  it('raises a version conflict when the guarded write matches no row', async () => {
    const { useCase } = build(squad(), null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'squad-1', {
        transition: SquadTransition.Publish,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(SquadVersionConflictError);
  });
});
