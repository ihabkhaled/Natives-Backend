import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { SelectionEventType, SelectionRole } from '../model/squads.enums';
import type { SelectionRow } from '../model/squads.rows';
import type {
  NewSelectionEvent,
  SelectionRemoval,
  SelectionWrite,
} from '../model/squads.types';
import { SquadSelectionRepository } from './squad-selection.repository';

const NOW = new Date('2026-02-01T12:00:00.000Z');

function row(overrides: Partial<SelectionRow> = {}): SelectionRow {
  return {
    id: 'sel-1',
    squad_id: 'squad-1',
    team_id: 'team-1',
    membership_id: 'm-1',
    selection_role: 'player',
    status: 'selected',
    reason: null,
    eligibility_overridden: false,
    override_reason: null,
    overridden_by: null,
    eligibility_snapshot: 'passed',
    selected_by: 'user-2',
    removed_by: null,
    removed_at: null,
    record_version: 1,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function runner(rows: SelectionRow[]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn().mockResolvedValue(rows);
  return { scope: { run }, run };
}

function write(): SelectionWrite {
  return {
    id: 'sel-1',
    squadId: 'squad-1',
    teamId: 'team-1',
    membershipId: 'm-1',
    selectionRole: SelectionRole.Player,
    reason: null,
    eligibilityOverridden: false,
    overrideReason: null,
    overriddenBy: null,
    eligibilitySnapshot: 'passed',
    selectedBy: 'user-2',
    now: NOW,
  };
}

describe('SquadSelectionRepository', () => {
  const repository = new SquadSelectionRepository();

  it('upserts a selection and returns the mapped row', async () => {
    const { scope, run } = runner([row()]);
    const selection = await repository.upsert(scope, write());
    expect(selection.membershipId).toBe('m-1');
    expect(String(run.mock.calls[0]?.[0])).toContain('ON CONFLICT');
  });

  it('throws when the upsert returns no row', async () => {
    const { scope } = runner([]);
    await expect(repository.upsert(scope, write())).rejects.toThrow(
      'Expected a returned row',
    );
  });

  it('soft-removes an active selection or returns null', async () => {
    const removal: SelectionRemoval = {
      squadId: 'squad-1',
      membershipId: 'm-1',
      removedBy: 'user-2',
      reason: 'cut',
      now: NOW,
    };
    const present = runner([row({ status: 'removed' })]);
    expect(await repository.softRemove(present.scope, removal)).not.toBeNull();
    const absent = runner([]);
    expect(await repository.softRemove(absent.scope, removal)).toBeNull();
  });

  it('finds an active selection or returns null', async () => {
    const present = runner([row()]);
    expect(
      await repository.findActive(present.scope, 'squad-1', 'm-1'),
    ).not.toBeNull();
    const absent = runner([]);
    expect(
      await repository.findActive(absent.scope, 'squad-1', 'm-1'),
    ).toBeNull();
  });

  it('appends a selection history event', async () => {
    const { scope, run } = runner([]);
    const event: NewSelectionEvent = {
      id: 'ev-1',
      squadId: 'squad-1',
      membershipId: 'm-1',
      eventType: SelectionEventType.Selected,
      selectionRole: SelectionRole.Player,
      reason: null,
      eligibilitySnapshot: 'passed',
      actorUserId: 'user-2',
      now: NOW,
    };
    await repository.appendEvent(scope, event);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'INSERT INTO "squad_selection_events"',
    );
  });

  it('counts active and total selections', async () => {
    const active = { run: vi.fn().mockResolvedValue([{ count: 3 }]) };
    expect(
      await repository.countActive(
        active as unknown as TransactionScope,
        'squad-1',
      ),
    ).toBe(3);
    const empty = { run: vi.fn().mockResolvedValue([]) };
    expect(
      await repository.countForSquad(
        empty as unknown as TransactionScope,
        'squad-1',
      ),
    ).toBe(0);
  });

  it('lists selections for a squad in a bounded window', async () => {
    const { scope } = runner([
      row(),
      row({ id: 'sel-2', membership_id: 'm-2' }),
    ]);
    const items = await repository.listForSquad(scope, 'squad-1', {
      limit: 20,
      offset: 0,
    });
    expect(items).toHaveLength(2);
  });
});
