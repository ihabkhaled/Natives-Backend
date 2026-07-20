import { describe, expect, it } from 'vitest';

import { RosterAudience, RosterKind } from '../model/rosters.enums';
import {
  notifiesNotSelected,
  notifiesSelected,
  resolvePublishAudience,
} from './roster-notification.policy';

describe('roster-notification.policy', () => {
  it('tells both the selected and the not-selected for a competition roster', () => {
    const plan = resolvePublishAudience(RosterKind.Competition, 14, 6);
    expect(plan.audience).toBe(RosterAudience.SelectedAndNotSelected);
    expect(plan.selectedCount).toBe(14);
    expect(plan.notSelectedCount).toBe(6);
    expect(notifiesSelected(plan)).toBe(true);
    expect(notifiesNotSelected(plan)).toBe(true);
  });

  it('tells only the named players for a match roster', () => {
    const plan = resolvePublishAudience(RosterKind.Match, 12, 8);
    expect(plan.audience).toBe(RosterAudience.SelectedOnly);
    expect(notifiesSelected(plan)).toBe(true);
    expect(notifiesNotSelected(plan)).toBe(false);
  });

  it('tells nobody when the roster names nobody', () => {
    const competition = resolvePublishAudience(RosterKind.Competition, 0, 20);
    expect(competition.audience).toBe(RosterAudience.None);
    expect(notifiesSelected(competition)).toBe(false);
    expect(notifiesNotSelected(competition)).toBe(false);
    expect(resolvePublishAudience(RosterKind.Match, 0, 0).audience).toBe(
      RosterAudience.None,
    );
  });

  it('carries counts only — never a list of who was left out', () => {
    const plan = resolvePublishAudience(RosterKind.Competition, 1, 2);
    expect(Object.keys(plan)).toEqual([
      'audience',
      'selectedCount',
      'notSelectedCount',
    ]);
  });
});
