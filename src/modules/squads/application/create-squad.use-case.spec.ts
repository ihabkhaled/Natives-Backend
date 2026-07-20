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

import { SquadValidationError } from '../errors/squad-validation.error';
import { SquadRepository } from '../infrastructure/squad.repository';
import { SquadStatus } from '../model/squads.enums';
import type { Squad, SquadContent } from '../model/squads.types';
import { CreateSquadUseCase } from './create-squad.use-case';
import type { SquadScopeService } from './squad-scope.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const NOW = new Date('2026-02-01T12:00:00.000Z');
const UOW: UnitOfWorkPort = { runInTransaction: op => op(TX) };
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'squad-1' };
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'c@x.test',
  roles: [],
};

function content(thresholdPct = 70): SquadContent {
  return {
    name: 'Squad',
    seasonId: 'season-1',
    competitionId: null,
    attendanceThresholdPct: thresholdPct,
    selectionDeadline: null,
    notes: null,
  };
}

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

function build(insertResult: Squad): {
  useCase: CreateSquadUseCase;
  scope: { validate: ReturnType<typeof vi.fn> };
  audit: { record: ReturnType<typeof vi.fn> };
  events: { enqueue: ReturnType<typeof vi.fn> };
} {
  const scope = { validate: vi.fn().mockResolvedValue(undefined) };
  const repo = {
    insert: vi.fn().mockResolvedValue(insertResult),
  } as unknown as SquadRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CreateSquadUseCase(
    UOW,
    CLOCK,
    ID_GEN,
    scope as unknown as SquadScopeService,
    repo,
    audit as unknown as AuditRecorderService,
    events as unknown as RecordDomainEventService,
  );
  return { useCase, scope, audit, events };
}

describe('CreateSquadUseCase', () => {
  it('validates scope, writes the draft, audits, and enqueues squad.created', async () => {
    const { useCase, scope, audit, events } = build(squad());
    const created = await useCase.execute(ACTOR, 'team-1', {
      content: content(),
    });
    expect(created.squadId).toBe('squad-1');
    expect(scope.validate).toHaveBeenCalledWith(TX, 'team-1', 'season-1', null);
    expect(audit.record).toHaveBeenCalledOnce();
    expect(events.enqueue).toHaveBeenCalledOnce();
  });

  it('rejects an out-of-range attendance threshold with a validation error', async () => {
    const { useCase } = build(squad());
    await expect(
      useCase.execute(ACTOR, 'team-1', { content: content(150) }),
    ).rejects.toBeInstanceOf(SquadValidationError);
  });
});
