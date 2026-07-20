import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { RosterMemberStatus } from '../model/rosters.enums';
import type { RosterCandidateRow } from '../model/rosters.rows';
import { RosterSourceRepository } from './roster-source.repository';

function candidateRow(
  overrides: Partial<RosterCandidateRow> = {},
): RosterCandidateRow {
  return {
    membership_id: 'member-1',
    member_status: 'active',
    gender: 'woman',
    jersey_number: 11,
    availability: null,
    selected_in_squad: true,
    ...overrides,
  };
}

function scopeReturning(result: unknown[]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn().mockResolvedValue(result);
  return { scope: { run }, run };
}

describe('RosterSourceRepository', () => {
  const repository = new RosterSourceRepository();

  it('finds one candidate with its classification, or null', async () => {
    const found = scopeReturning([candidateRow()]);
    const candidate = await repository.findCandidate(
      found.scope,
      'team-1',
      'season-1',
      'roster-1',
      'squad-1',
      'member-1',
    );
    expect(candidate?.memberStatus).toBe(RosterMemberStatus.Active);
    expect(candidate?.selectedInSquad).toBe(true);
    expect(found.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      'season-1',
      'roster-1',
      'squad-1',
      'member-1',
    ]);
    const missing = scopeReturning([]);
    expect(
      await repository.findCandidate(
        missing.scope,
        'team-1',
        'season-1',
        'roster-1',
        null,
        'member-9',
      ),
    ).toBeNull();
  });

  it('caps the generate-from-squad expansion at the module ceiling', async () => {
    const { scope, run } = scopeReturning([
      candidateRow(),
      candidateRow({ membership_id: 'member-2' }),
    ]);
    const candidates = await repository.listSquadSelections(
      scope,
      'team-1',
      'season-1',
      'roster-1',
      'squad-1',
    );
    expect(candidates).toHaveLength(2);
    expect((run.mock.calls[0]?.[1] as unknown[])[4]).toBe(60);
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).toContain('sel."id" IS NOT NULL');
    expect(statement).toContain(`NOT IN ('archived', 'anonymized')`);
  });

  it('counts the not-selected as a number only, never as a list', async () => {
    const counted = scopeReturning([{ count: 6 }]);
    expect(
      await repository.countNotSelected(
        counted.scope,
        'team-1',
        'season-1',
        'roster-1',
      ),
    ).toBe(6);
    expect(String(counted.run.mock.calls[0]?.[0])).toContain('NOT EXISTS');
    const empty = scopeReturning([]);
    expect(
      await repository.countNotSelected(
        empty.scope,
        'team-1',
        'season-1',
        'roster-1',
      ),
    ).toBe(0);
  });

  it('resolves the caller’s own membership, preferring the season one', async () => {
    const found = scopeReturning([{ id: 'membership-1' }]);
    expect(
      await repository.resolveActiveMembership(
        found.scope,
        'team-1',
        'season-1',
        'user-1',
      ),
    ).toBe('membership-1');
    expect(String(found.run.mock.calls[0]?.[0])).toContain('LIMIT 1');
    const stranger = scopeReturning([]);
    expect(
      await repository.resolveActiveMembership(
        stranger.scope,
        'team-1',
        'season-1',
        'user-9',
      ),
    ).toBeNull();
  });

  it('never selects a membership that has left or been anonymized', async () => {
    const { scope, run } = scopeReturning([]);
    await repository.resolveActiveMembership(
      scope,
      'team-1',
      'season-1',
      'user-1',
    );
    expect(String(run.mock.calls[0]?.[0])).toContain(
      `NOT IN ('archived', 'anonymized', 'left')`,
    );
  });

  it('is a data-access surface only — no mutation method exists', () => {
    expect(
      Object.getOwnPropertyNames(RosterSourceRepository.prototype).sort(),
    ).toEqual([
      'constructor',
      'countNotSelected',
      'findCandidate',
      'listSquadSelections',
      'resolveActiveMembership',
    ]);
  });
});
