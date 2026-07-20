import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import type { OpponentRow } from '../model/competitions.rows';
import type { NewOpponent } from '../model/competitions.types';
import { OpponentRepository } from './opponent.repository';

const NOW = new Date('2026-03-01T12:00:00.000Z');

function row(overrides: Partial<OpponentRow> = {}): OpponentRow {
  return {
    id: 'opp-1',
    team_id: 'team-1',
    name: 'Alexandria Sharks',
    short_name: null,
    logo_ref: null,
    contact_name: null,
    contact_info: null,
    notes: null,
    status: 'active',
    record_version: 1,
    created_by: 'user-1',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function scope(rows: unknown[]): TransactionScope {
  return {
    run: vi.fn().mockResolvedValue(rows),
  };
}

function newOpponent(): NewOpponent {
  return {
    id: 'opp-1',
    teamId: 'team-1',
    content: {
      name: 'Alexandria Sharks',
      shortName: null,
      logoRef: null,
      contactName: null,
      contactInfo: null,
      notes: null,
    },
    createdBy: 'user-1',
    now: NOW,
  };
}

describe('OpponentRepository', () => {
  const repository = new OpponentRepository();

  it('inserts an opponent and maps the row', async () => {
    const created = await repository.insert(scope([row()]), newOpponent());
    expect(created?.opponentId).toBe('opp-1');
  });

  it('returns null when the name conflicts (ON CONFLICT DO NOTHING)', async () => {
    expect(await repository.insert(scope([]), newOpponent())).toBeNull();
  });

  it('reports active membership in a team', async () => {
    expect(
      await repository.activeInTeam(
        scope([{ id: 'opp-1' }]),
        'team-1',
        'opp-1',
      ),
    ).toBe(true);
    expect(await repository.activeInTeam(scope([]), 'team-1', 'opp-1')).toBe(
      false,
    );
  });

  it('lists and counts opponents for a team', async () => {
    const items = await repository.listForTeam(
      scope([row(), row({ id: 'opp-2' })]),
      'team-1',
      { limit: 20, offset: 0 },
    );
    expect(items).toHaveLength(2);
    expect(await repository.countForTeam(scope([{ count: 2 }]), 'team-1')).toBe(
      2,
    );
    expect(await repository.countForTeam(scope([]), 'team-1')).toBe(0);
  });
});
