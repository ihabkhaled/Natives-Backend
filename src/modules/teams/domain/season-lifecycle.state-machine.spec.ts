import { describe, expect, it } from 'vitest';

import { SEASON_STATUS_VALUES, SeasonStatus } from '../model/teams.enums';
import {
  allowedSeasonTransitions,
  canTransitionSeason,
  claimsCurrentSeasonSlot,
} from './season-lifecycle.state-machine';

describe('canTransitionSeason', () => {
  it('activates or archives a draft season', () => {
    expect(canTransitionSeason(SeasonStatus.Draft, SeasonStatus.Active)).toBe(
      true,
    );
    expect(canTransitionSeason(SeasonStatus.Draft, SeasonStatus.Archived)).toBe(
      true,
    );
    expect(canTransitionSeason(SeasonStatus.Draft, SeasonStatus.Closed)).toBe(
      false,
    );
  });

  it('closes or archives an active season but never returns it to draft', () => {
    expect(canTransitionSeason(SeasonStatus.Active, SeasonStatus.Closed)).toBe(
      true,
    );
    expect(
      canTransitionSeason(SeasonStatus.Active, SeasonStatus.Archived),
    ).toBe(true);
    expect(canTransitionSeason(SeasonStatus.Active, SeasonStatus.Draft)).toBe(
      false,
    );
  });

  it('re-opens or archives a closed season', () => {
    expect(canTransitionSeason(SeasonStatus.Closed, SeasonStatus.Active)).toBe(
      true,
    );
    expect(
      canTransitionSeason(SeasonStatus.Closed, SeasonStatus.Archived),
    ).toBe(true);
    expect(canTransitionSeason(SeasonStatus.Closed, SeasonStatus.Draft)).toBe(
      false,
    );
  });

  it('revives an archived season only back to draft', () => {
    expect(canTransitionSeason(SeasonStatus.Archived, SeasonStatus.Draft)).toBe(
      true,
    );
    expect(
      canTransitionSeason(SeasonStatus.Archived, SeasonStatus.Active),
    ).toBe(false);
    expect(
      canTransitionSeason(SeasonStatus.Archived, SeasonStatus.Closed),
    ).toBe(false);
  });

  it('rejects a no-op transition to the same status', () => {
    for (const status of SEASON_STATUS_VALUES) {
      expect(canTransitionSeason(status, status)).toBe(false);
    }
  });
});

describe('allowedSeasonTransitions', () => {
  it('lists the reachable states for every status', () => {
    expect(allowedSeasonTransitions(SeasonStatus.Draft)).toEqual([
      SeasonStatus.Active,
      SeasonStatus.Archived,
    ]);
    expect(allowedSeasonTransitions(SeasonStatus.Active)).toEqual([
      SeasonStatus.Closed,
      SeasonStatus.Archived,
    ]);
    expect(allowedSeasonTransitions(SeasonStatus.Closed)).toEqual([
      SeasonStatus.Active,
      SeasonStatus.Archived,
    ]);
    expect(allowedSeasonTransitions(SeasonStatus.Archived)).toEqual([
      SeasonStatus.Draft,
    ]);
  });
});

describe('claimsCurrentSeasonSlot', () => {
  it('is true only for the active target', () => {
    expect(claimsCurrentSeasonSlot(SeasonStatus.Active)).toBe(true);
    expect(claimsCurrentSeasonSlot(SeasonStatus.Draft)).toBe(false);
    expect(claimsCurrentSeasonSlot(SeasonStatus.Closed)).toBe(false);
    expect(claimsCurrentSeasonSlot(SeasonStatus.Archived)).toBe(false);
  });
});
