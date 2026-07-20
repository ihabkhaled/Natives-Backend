import { describe, expect, it } from 'vitest';

import { RosterStatus, RosterTransition } from '../model/rosters.enums';
import {
  allowedRosterTransitions,
  canTransitionRoster,
  enforcesConstraints,
  isArchiveTarget,
  isLockTarget,
  isPublishTarget,
  isRevisable,
  isReviseTarget,
  isRosterFrozen,
  resolveRosterTarget,
} from './roster.state-machine';

describe('roster.state-machine', () => {
  it('permits the forward lifecycle draft → published → locked → revised', () => {
    expect(
      canTransitionRoster(RosterStatus.Draft, RosterStatus.Published),
    ).toBe(true);
    expect(
      canTransitionRoster(RosterStatus.Published, RosterStatus.Locked),
    ).toBe(true);
    expect(canTransitionRoster(RosterStatus.Locked, RosterStatus.Revised)).toBe(
      true,
    );
    expect(
      canTransitionRoster(RosterStatus.Revised, RosterStatus.Archived),
    ).toBe(true);
  });

  it('permits superseding a published roster and archiving from any live state', () => {
    expect(
      canTransitionRoster(RosterStatus.Published, RosterStatus.Revised),
    ).toBe(true);
    expect(canTransitionRoster(RosterStatus.Draft, RosterStatus.Archived)).toBe(
      true,
    );
    expect(
      canTransitionRoster(RosterStatus.Published, RosterStatus.Archived),
    ).toBe(true);
    expect(
      canTransitionRoster(RosterStatus.Locked, RosterStatus.Archived),
    ).toBe(true);
  });

  it('never reopens a frozen roster in place, and archived is terminal', () => {
    expect(canTransitionRoster(RosterStatus.Locked, RosterStatus.Draft)).toBe(
      false,
    );
    expect(canTransitionRoster(RosterStatus.Revised, RosterStatus.Draft)).toBe(
      false,
    );
    expect(canTransitionRoster(RosterStatus.Draft, RosterStatus.Locked)).toBe(
      false,
    );
    expect(canTransitionRoster(RosterStatus.Archived, RosterStatus.Draft)).toBe(
      false,
    );
    expect(allowedRosterTransitions(RosterStatus.Archived)).toEqual([]);
  });

  it('lists every reachable state from each live status', () => {
    expect(allowedRosterTransitions(RosterStatus.Draft)).toEqual([
      RosterStatus.Published,
      RosterStatus.Archived,
    ]);
    expect(allowedRosterTransitions(RosterStatus.Published)).toEqual([
      RosterStatus.Locked,
      RosterStatus.Revised,
      RosterStatus.Archived,
    ]);
    expect(allowedRosterTransitions(RosterStatus.Locked)).toEqual([
      RosterStatus.Revised,
      RosterStatus.Archived,
    ]);
    expect(allowedRosterTransitions(RosterStatus.Revised)).toEqual([
      RosterStatus.Archived,
    ]);
  });

  it('resolves each plain transition verb to its target status', () => {
    expect(resolveRosterTarget(RosterTransition.Publish)).toBe(
      RosterStatus.Published,
    );
    expect(resolveRosterTarget(RosterTransition.Archive)).toBe(
      RosterStatus.Archived,
    );
  });

  it('classifies publish, lock, revise, and archive targets', () => {
    expect(isPublishTarget(RosterStatus.Published)).toBe(true);
    expect(isPublishTarget(RosterStatus.Locked)).toBe(false);
    expect(isLockTarget(RosterStatus.Locked)).toBe(true);
    expect(isLockTarget(RosterStatus.Published)).toBe(false);
    expect(isReviseTarget(RosterStatus.Revised)).toBe(true);
    expect(isReviseTarget(RosterStatus.Draft)).toBe(false);
    expect(isArchiveTarget(RosterStatus.Archived)).toBe(true);
    expect(isArchiveTarget(RosterStatus.Draft)).toBe(false);
  });

  it('freezes entries for locked, revised, and archived rosters only', () => {
    expect(isRosterFrozen(RosterStatus.Locked)).toBe(true);
    expect(isRosterFrozen(RosterStatus.Revised)).toBe(true);
    expect(isRosterFrozen(RosterStatus.Archived)).toBe(true);
    expect(isRosterFrozen(RosterStatus.Draft)).toBe(false);
    expect(isRosterFrozen(RosterStatus.Published)).toBe(false);
  });

  it('allows a revision only from a published or locked roster', () => {
    expect(isRevisable(RosterStatus.Published)).toBe(true);
    expect(isRevisable(RosterStatus.Locked)).toBe(true);
    expect(isRevisable(RosterStatus.Draft)).toBe(false);
    expect(isRevisable(RosterStatus.Revised)).toBe(false);
    expect(isRevisable(RosterStatus.Archived)).toBe(false);
  });

  it('enforces the composition constraints when freezing, not when archiving', () => {
    expect(enforcesConstraints(RosterStatus.Published)).toBe(true);
    expect(enforcesConstraints(RosterStatus.Locked)).toBe(true);
    expect(enforcesConstraints(RosterStatus.Archived)).toBe(false);
    expect(enforcesConstraints(RosterStatus.Draft)).toBe(false);
  });
});
