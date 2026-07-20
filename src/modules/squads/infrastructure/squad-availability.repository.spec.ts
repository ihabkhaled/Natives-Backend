import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilitySource, AvailabilityStatus } from '../model/squads.enums';
import type { AvailabilityRow } from '../model/squads.rows';
import type { AvailabilityUpsert } from '../model/squads.types';
import { SquadAvailabilityRepository } from './squad-availability.repository';

const NOW = new Date('2026-02-01T12:00:00.000Z');

function row(overrides: Partial<AvailabilityRow> = {}): AvailabilityRow {
  return {
    id: 'av-1',
    squad_id: 'squad-1',
    team_id: 'team-1',
    membership_id: 'm-1',
    availability: 'available',
    reason: null,
    source: 'self',
    declared_by: 'user-1',
    record_version: 1,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function runner(rows: AvailabilityRow[]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn().mockResolvedValue(rows);
  return { scope: { run }, run };
}

function upsert(): AvailabilityUpsert {
  return {
    id: 'av-1',
    squadId: 'squad-1',
    teamId: 'team-1',
    membershipId: 'm-1',
    availability: AvailabilityStatus.Available,
    reason: null,
    source: AvailabilitySource.Self,
    declaredBy: 'user-1',
    now: NOW,
  };
}

describe('SquadAvailabilityRepository', () => {
  const repository = new SquadAvailabilityRepository();

  it('upserts an availability declaration', async () => {
    const { scope, run } = runner([row()]);
    const availability = await repository.upsert(scope, upsert());
    expect(availability.availability).toBe(AvailabilityStatus.Available);
    expect(String(run.mock.calls[0]?.[0])).toContain('ON CONFLICT');
  });

  it('throws when the upsert returns no row', async () => {
    const { scope } = runner([]);
    await expect(repository.upsert(scope, upsert())).rejects.toThrow(
      'Expected a returned row',
    );
  });

  it('lists and counts availability for a squad', async () => {
    const { scope } = runner([
      row(),
      row({ id: 'av-2', membership_id: 'm-2' }),
    ]);
    const items = await repository.listForSquad(scope, 'squad-1', {
      limit: 20,
      offset: 0,
    });
    expect(items).toHaveLength(2);
    const count = { run: vi.fn().mockResolvedValue([{ count: 2 }]) };
    expect(
      await repository.countForSquad(
        count as unknown as TransactionScope,
        'squad-1',
      ),
    ).toBe(2);
    const empty = { run: vi.fn().mockResolvedValue([]) };
    expect(
      await repository.countForSquad(
        empty as unknown as TransactionScope,
        'squad-1',
      ),
    ).toBe(0);
  });
});
