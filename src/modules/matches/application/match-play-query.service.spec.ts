import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { MatchNotFoundError } from '../errors/match-not-found.error';
import type { MatchPlayEventRepository } from '../infrastructure/match-play-event.repository';
import { MatchPlayType } from '../model/matches.enums';
import type { MatchPlayEvent } from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import { MatchPlayQueryService } from './match-play-query.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-05-01T10:00:00.000Z');

function play(overrides: Partial<MatchPlayEvent> = {}): MatchPlayEvent {
  return {
    playId: 'play-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 1,
    operationId: 'op-1',
    requestHash: 'hash-1',
    playType: MatchPlayType.Goal,
    pointNumber: 1,
    period: 1,
    startingLine: null,
    scoringSide: null,
    primaryMembershipId: null,
    secondaryMembershipId: null,
    assistState: null,
    callahan: false,
    durationSeconds: null,
    correctsPlayId: null,
    correctionReason: null,
    retracted: false,
    notes: null,
    recordedBy: 'user-1',
    occurredAt: null,
    recordedAt: NOW,
    ...overrides,
  };
}

function service(lookupFails = false): MatchPlayQueryService {
  const lookup = {
    require: lookupFails
      ? vi.fn().mockRejectedValue(new MatchNotFoundError())
      : vi.fn().mockResolvedValue({ matchId: 'match-1' }),
  } as unknown as MatchLookupService;
  const plays = {
    listForMatch: vi
      .fn()
      .mockResolvedValue([play(), play({ playId: 'p2', retracted: true })]),
    countForMatch: vi.fn().mockResolvedValue(2),
  } as unknown as MatchPlayEventRepository;
  return new MatchPlayQueryService(UOW, lookup, plays);
}

describe('MatchPlayQueryService', () => {
  it('returns the whole recorded history, retracted facts included', async () => {
    const page = await service().listForMatch('team-1', 'match-1', {
      limit: 50,
      offset: 0,
    });
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(2);
    expect(page.items[1]?.retracted).toBe(true);
  });

  it('echoes the bounded window it read', async () => {
    const page = await service().listForMatch('team-1', 'match-1', {
      limit: 25,
      offset: 5,
    });
    expect(page.limit).toBe(25);
    expect(page.offset).toBe(5);
  });

  it('hides another team’s match behind a not-found', async () => {
    await expect(
      service(true).listForMatch('team-9', 'match-1', { limit: 5, offset: 0 }),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
  });
});
