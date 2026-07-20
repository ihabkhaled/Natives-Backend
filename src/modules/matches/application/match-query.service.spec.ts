import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import type { MatchRepository } from '../infrastructure/match.repository';
import { MatchStatus } from '../model/matches.enums';
import type { Match } from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import { MatchQueryService } from './match-query.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const FILTER = {
  competitionId: 'comp-1',
  fixtureId: null,
  status: MatchStatus.Live,
};

function build(items: Match[], total: number): MatchQueryService {
  const repository = {
    listForScope: vi.fn().mockResolvedValue(items),
    countForScope: vi.fn().mockResolvedValue(total),
  } as unknown as MatchRepository;
  const lookup = {
    require: vi.fn().mockResolvedValue(items[0] ?? null),
  } as unknown as MatchLookupService;
  return new MatchQueryService(UOW, repository, lookup);
}

describe('MatchQueryService', () => {
  it('returns a bounded page echoing the requested window', async () => {
    const match = { matchId: 'match-1' } as Match;
    expect(
      await build([match], 3).listForScope('team-1', FILTER, {
        limit: 20,
        offset: 10,
      }),
    ).toEqual({ items: [match], total: 3, limit: 20, offset: 10 });
  });

  it('returns an empty page without inventing a total', async () => {
    expect(
      await build([], 0).listForScope('team-1', FILTER, {
        limit: 5,
        offset: 0,
      }),
    ).toEqual({ items: [], total: 0, limit: 5, offset: 0 });
  });

  it('resolves one match through the team-scoped lookup', async () => {
    const match = { matchId: 'match-1' } as Match;
    expect(await build([match], 1).getById('team-1', 'match-1')).toBe(match);
  });
});
