import { describe, expect, it } from 'vitest';

import { TEAM_STATUS_VALUES, TeamStatus } from '../model/teams.enums';
import {
  allowedTeamTransitions,
  canAcceptTeamWork,
  canRemoveTeam,
  canTransitionTeam,
} from './team-lifecycle.state-machine';

const REMOVED_AT = new Date('2026-07-20T00:00:00.000Z');

describe('canTransitionTeam', () => {
  it('allows disabling and archiving an active team', () => {
    expect(canTransitionTeam(TeamStatus.Active, TeamStatus.Disabled)).toBe(
      true,
    );
    expect(canTransitionTeam(TeamStatus.Active, TeamStatus.Archived)).toBe(
      true,
    );
  });

  it('allows re-activating and archiving a disabled team', () => {
    expect(canTransitionTeam(TeamStatus.Disabled, TeamStatus.Active)).toBe(
      true,
    );
    expect(canTransitionTeam(TeamStatus.Disabled, TeamStatus.Archived)).toBe(
      true,
    );
  });

  it('allows re-opening an archived team but not disabling it directly', () => {
    expect(canTransitionTeam(TeamStatus.Archived, TeamStatus.Active)).toBe(
      true,
    );
    expect(canTransitionTeam(TeamStatus.Archived, TeamStatus.Disabled)).toBe(
      false,
    );
  });

  it('rejects a no-op transition to the same status', () => {
    for (const status of TEAM_STATUS_VALUES) {
      expect(canTransitionTeam(status, status)).toBe(false);
    }
  });
});

describe('allowedTeamTransitions', () => {
  it('lists the reachable states for every status', () => {
    expect(allowedTeamTransitions(TeamStatus.Active)).toEqual([
      TeamStatus.Disabled,
      TeamStatus.Archived,
    ]);
    expect(allowedTeamTransitions(TeamStatus.Disabled)).toEqual([
      TeamStatus.Active,
      TeamStatus.Archived,
    ]);
    expect(allowedTeamTransitions(TeamStatus.Archived)).toEqual([
      TeamStatus.Active,
    ]);
  });
});

describe('canRemoveTeam', () => {
  it('permits soft removal only from the archived end-state', () => {
    expect(canRemoveTeam(TeamStatus.Archived, null)).toBe(true);
    expect(canRemoveTeam(TeamStatus.Active, null)).toBe(false);
    expect(canRemoveTeam(TeamStatus.Disabled, null)).toBe(false);
  });

  it('refuses to remove an already-removed team', () => {
    expect(canRemoveTeam(TeamStatus.Archived, REMOVED_AT)).toBe(false);
  });
});

describe('canAcceptTeamWork', () => {
  it('accepts new scoped work only for a live active team', () => {
    expect(canAcceptTeamWork(TeamStatus.Active, null)).toBe(true);
    expect(canAcceptTeamWork(TeamStatus.Disabled, null)).toBe(false);
    expect(canAcceptTeamWork(TeamStatus.Archived, null)).toBe(false);
    expect(canAcceptTeamWork(TeamStatus.Active, REMOVED_AT)).toBe(false);
  });
});
