import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { MatchNotFoundError } from '../errors/match-not-found.error';
import type { MatchRevisionRepository } from '../infrastructure/match-revision.repository';
import type { MatchRevision } from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import { MatchRevisionQueryService } from './match-revision-query.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };

function build(
  items: MatchRevision[],
  total: number,
  found = true,
): MatchRevisionQueryService {
  const lookup = {
    require: vi.fn().mockImplementation(() => {
      if (!found) {
        throw new MatchNotFoundError();
      }
      return Promise.resolve({ matchId: 'match-1' });
    }),
  } as unknown as MatchLookupService;
  const revisions = {
    listForMatch: vi.fn().mockResolvedValue(items),
    countForMatch: vi.fn().mockResolvedValue(total),
  } as unknown as MatchRevisionRepository;
  return new MatchRevisionQueryService(UOW, lookup, revisions);
}

describe('MatchRevisionQueryService', () => {
  it('returns the bounded correction trail echoing the window', async () => {
    const revision = { revisionId: 'revision-1' } as MatchRevision;
    expect(
      await build([revision], 2).listForMatch('team-1', 'match-1', {
        limit: 50,
        offset: 0,
      }),
    ).toEqual({ items: [revision], total: 2, limit: 50, offset: 0 });
  });

  it('returns an empty trail for a match never finalized', async () => {
    expect(
      await build([], 0).listForMatch('team-1', 'match-1', {
        limit: 50,
        offset: 0,
      }),
    ).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
  });

  it('hides another team’s trail behind the match lookup', async () => {
    await expect(
      build([], 0, false).listForMatch('team-2', 'match-1', {
        limit: 50,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
  });
});
