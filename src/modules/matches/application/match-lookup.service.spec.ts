import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { MatchNotFoundError } from '../errors/match-not-found.error';
import { MatchRulesetNotFoundError } from '../errors/match-ruleset-not-found.error';
import type { MatchRepository } from '../infrastructure/match.repository';
import type { MatchRulesetRepository } from '../infrastructure/match-ruleset.repository';
import { MatchLookupService } from './match-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;

function build(match: unknown, ruleset: unknown): MatchLookupService {
  return new MatchLookupService(
    {
      findForWrite: vi.fn().mockResolvedValue(match),
    } as unknown as MatchRepository,
    {
      findById: vi.fn().mockResolvedValue(ruleset),
    } as unknown as MatchRulesetRepository,
  );
}

describe('MatchLookupService', () => {
  it('resolves a team-owned match', async () => {
    const service = build({ matchId: 'match-1' }, null);
    await expect(service.require(TX, 'team-1', 'match-1')).resolves.toEqual({
      matchId: 'match-1',
    });
  });

  it('hides a match another team owns behind a not-found', async () => {
    const service = build(null, null);
    await expect(
      service.require(TX, 'team-2', 'match-1'),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
  });

  it('resolves the versioned ruleset a match is played under', async () => {
    const service = build(null, { rulesetId: 'rules-1' });
    await expect(
      service.requireRuleset(TX, 'team-1', 'rules-1'),
    ).resolves.toEqual({ rulesetId: 'rules-1' });
  });

  it('raises a not-found when the pinned ruleset is missing', async () => {
    const service = build(null, null);
    await expect(
      service.requireRuleset(TX, 'team-1', 'rules-1'),
    ).rejects.toBeInstanceOf(MatchRulesetNotFoundError);
  });
});
