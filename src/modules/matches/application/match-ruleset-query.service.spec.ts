import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import type { MatchRulesetRepository } from '../infrastructure/match-ruleset.repository';
import type { MatchRuleset } from '../model/matches.types';
import { MatchRulesetQueryService } from './match-ruleset-query.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };

function build(items: MatchRuleset[], total: number): MatchRulesetQueryService {
  return new MatchRulesetQueryService(UOW, {
    listForTeam: vi.fn().mockResolvedValue(items),
    countForTeam: vi.fn().mockResolvedValue(total),
  } as unknown as MatchRulesetRepository);
}

describe('MatchRulesetQueryService', () => {
  it('returns every published version in a bounded page', async () => {
    const ruleset = { rulesetId: 'rules-1' } as MatchRuleset;
    expect(
      await build([ruleset], 5).listForTeam('team-1', {
        limit: 20,
        offset: 0,
      }),
    ).toEqual({ items: [ruleset], total: 5, limit: 20, offset: 0 });
  });

  it('returns an empty page for a team with no ruleset yet', async () => {
    expect(
      await build([], 0).listForTeam('team-1', { limit: 20, offset: 0 }),
    ).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });
});
