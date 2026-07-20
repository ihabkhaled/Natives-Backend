import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { CandidateStatus } from '../model/squads.enums';
import type { CandidateRow } from '../model/squads.rows';
import { SquadEligibilityRepository } from './squad-eligibility.repository';

function candidate(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    membership_id: 'm-1',
    full_name: 'Player One',
    status: 'active',
    registered_in_season: true,
    gender: 'man',
    jersey_number: 7,
    attended_sessions: 8,
    eligible_sessions: 10,
    injured_sessions: 0,
    availability: 'available',
    selected: false,
    selection_overridden: false,
    ...overrides,
  };
}

function scope(rows: unknown[]): TransactionScope {
  return { run: vi.fn().mockResolvedValue(rows) };
}

describe('SquadEligibilityRepository', () => {
  const repository = new SquadEligibilityRepository();

  it('finds a single candidate or returns null', async () => {
    expect(
      await repository.findCandidate(
        scope([candidate()]),
        'team-1',
        'season-1',
        'squad-1',
        'm-1',
      ),
    ).not.toBeNull();
    expect(
      await repository.findCandidate(
        scope([]),
        'team-1',
        'season-1',
        'squad-1',
        'm-1',
      ),
    ).toBeNull();
  });

  it('lists candidates and maps them to eligibility inputs', async () => {
    const inputs = await repository.listCandidates(
      scope([
        candidate(),
        candidate({ membership_id: 'm-2', status: 'invited' }),
      ]),
      'team-1',
      'season-1',
      'squad-1',
      { limit: 100, offset: 0 },
    );
    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.status).toBe(CandidateStatus.Active);
    expect(inputs[1]?.status).toBe(CandidateStatus.Invited);
  });

  it('counts candidates', async () => {
    expect(
      await repository.countCandidates(scope([{ count: 5 }]), 'team-1', 's-1'),
    ).toBe(5);
    expect(await repository.countCandidates(scope([]), 'team-1', 's-1')).toBe(
      0,
    );
  });

  it('reads grouped gender counts for the selected players', async () => {
    const counts = await repository.genderCountsForSelected(
      scope([
        { gender: 'man', count: 5 },
        { gender: null, count: 1 },
      ]),
      'squad-1',
    );
    expect(counts).toEqual([
      { gender: 'man', count: 5 },
      { gender: null, count: 1 },
    ]);
  });

  it('resolves the actor active membership or returns null', async () => {
    expect(
      await repository.resolveActiveMembership(
        scope([{ id: 'm-9' }]),
        'team-1',
        'season-1',
        'user-1',
      ),
    ).toBe('m-9');
    expect(
      await repository.resolveActiveMembership(
        scope([]),
        'team-1',
        'season-1',
        'user-1',
      ),
    ).toBeNull();
  });
});
