import { describe, expect, it } from 'vitest';

import { SelectionRole } from '../model/squads.enums';
import { toSelectionContent, toSquadContent } from './squads-command.mapper';

describe('squads-command.mapper', () => {
  it('defaults optional squad fields to explicit nulls and the candidate threshold', () => {
    const content = toSquadContent({ name: 'Squad', seasonId: 'season-1' });
    expect(content.competitionId).toBeNull();
    expect(content.selectionDeadline).toBeNull();
    expect(content.notes).toBeNull();
    expect(content.attendanceThresholdPct).toBe(70);
  });

  it('preserves supplied squad fields including a custom threshold', () => {
    const content = toSquadContent({
      name: 'Squad',
      seasonId: 'season-1',
      competitionId: 'comp-1',
      attendanceThresholdPct: 60,
      selectionDeadline: '2026-03-01T00:00:00.000Z',
      notes: 'nationals pool',
    });
    expect(content.competitionId).toBe('comp-1');
    expect(content.attendanceThresholdPct).toBe(60);
    expect(content.selectionDeadline).toBe('2026-03-01T00:00:00.000Z');
  });

  it('defaults the selection role to player and reason to null', () => {
    const content = toSelectionContent({ membershipId: 'm-1' });
    expect(content.selectionRole).toBe(SelectionRole.Player);
    expect(content.reason).toBeNull();
  });

  it('preserves a supplied selection role and reason', () => {
    const content = toSelectionContent({
      membershipId: 'm-1',
      selectionRole: SelectionRole.Captain,
      reason: 'starting handler',
    });
    expect(content.selectionRole).toBe(SelectionRole.Captain);
    expect(content.reason).toBe('starting handler');
  });
});
