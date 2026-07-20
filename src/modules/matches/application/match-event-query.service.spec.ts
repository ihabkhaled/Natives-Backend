import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { MatchNotFoundError } from '../errors/match-not-found.error';
import type { MatchEventRepository } from '../infrastructure/match-event.repository';
import type { MatchEvent } from '../model/matches.types';
import { MatchEventQueryService } from './match-event-query.service';
import type { MatchLookupService } from './match-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };

function build(
  items: MatchEvent[],
  total: number,
  found = true,
): MatchEventQueryService {
  const lookup = {
    require: vi.fn().mockImplementation(() => {
      if (!found) {
        throw new MatchNotFoundError();
      }
      return Promise.resolve({ matchId: 'match-1' });
    }),
  } as unknown as MatchLookupService;
  const events = {
    listForMatch: vi.fn().mockResolvedValue(items),
    countForMatch: vi.fn().mockResolvedValue(total),
  } as unknown as MatchEventRepository;
  return new MatchEventQueryService(UOW, lookup, events);
}

describe('MatchEventQueryService', () => {
  it('returns the bounded stream page echoing the requested window', async () => {
    const event = { eventId: 'event-1' } as MatchEvent;
    expect(
      await build([event], 4).listForMatch('team-1', 'match-1', {
        limit: 200,
        offset: 0,
      }),
    ).toEqual({ items: [event], total: 4, limit: 200, offset: 0 });
  });

  it('returns an empty stream without inventing a total', async () => {
    expect(
      await build([], 0).listForMatch('team-1', 'match-1', {
        limit: 10,
        offset: 0,
      }),
    ).toEqual({ items: [], total: 0, limit: 10, offset: 0 });
  });

  it('hides another team’s stream behind the match lookup', async () => {
    await expect(
      build([], 0, false).listForMatch('team-2', 'match-1', {
        limit: 10,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
  });
});
