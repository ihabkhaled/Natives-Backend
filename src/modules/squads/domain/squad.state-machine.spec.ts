import { describe, expect, it } from 'vitest';

import { SquadStatus, SquadTransition } from '../model/squads.enums';
import {
  allowedSquadTransitions,
  canTransitionSquad,
  isArchiveTarget,
  isLockTarget,
  isPublishTarget,
  isReviseTransition,
  isSelectionFrozen,
  resolveSquadTarget,
} from './squad.state-machine';

describe('squad.state-machine', () => {
  it('permits the forward lifecycle draft → published → locked → archived', () => {
    expect(canTransitionSquad(SquadStatus.Draft, SquadStatus.Published)).toBe(
      true,
    );
    expect(canTransitionSquad(SquadStatus.Published, SquadStatus.Locked)).toBe(
      true,
    );
    expect(canTransitionSquad(SquadStatus.Locked, SquadStatus.Archived)).toBe(
      true,
    );
    expect(canTransitionSquad(SquadStatus.Draft, SquadStatus.Archived)).toBe(
      true,
    );
  });

  it('permits revising a published or locked squad back to draft', () => {
    expect(canTransitionSquad(SquadStatus.Published, SquadStatus.Draft)).toBe(
      true,
    );
    expect(canTransitionSquad(SquadStatus.Locked, SquadStatus.Draft)).toBe(
      true,
    );
  });

  it('rejects illegal transitions and terminal moves out of archived', () => {
    expect(canTransitionSquad(SquadStatus.Draft, SquadStatus.Locked)).toBe(
      false,
    );
    expect(canTransitionSquad(SquadStatus.Archived, SquadStatus.Draft)).toBe(
      false,
    );
    expect(allowedSquadTransitions(SquadStatus.Archived)).toEqual([]);
  });

  it('resolves each transition verb to its target status', () => {
    expect(resolveSquadTarget(SquadTransition.Publish)).toBe(
      SquadStatus.Published,
    );
    expect(resolveSquadTarget(SquadTransition.Lock)).toBe(SquadStatus.Locked);
    expect(resolveSquadTarget(SquadTransition.Revise)).toBe(SquadStatus.Draft);
    expect(resolveSquadTarget(SquadTransition.Archive)).toBe(
      SquadStatus.Archived,
    );
  });

  it('classifies publish, lock, and archive targets', () => {
    expect(isPublishTarget(SquadStatus.Published)).toBe(true);
    expect(isPublishTarget(SquadStatus.Locked)).toBe(false);
    expect(isLockTarget(SquadStatus.Locked)).toBe(true);
    expect(isLockTarget(SquadStatus.Published)).toBe(false);
    expect(isArchiveTarget(SquadStatus.Archived)).toBe(true);
    expect(isArchiveTarget(SquadStatus.Draft)).toBe(false);
  });

  it('detects a revise transition only when leaving a non-draft state', () => {
    expect(isReviseTransition(SquadStatus.Published, SquadStatus.Draft)).toBe(
      true,
    );
    expect(isReviseTransition(SquadStatus.Locked, SquadStatus.Draft)).toBe(
      true,
    );
    expect(isReviseTransition(SquadStatus.Draft, SquadStatus.Draft)).toBe(
      false,
    );
    expect(isReviseTransition(SquadStatus.Draft, SquadStatus.Published)).toBe(
      false,
    );
  });

  it('freezes selection only for locked and archived squads', () => {
    expect(isSelectionFrozen(SquadStatus.Locked)).toBe(true);
    expect(isSelectionFrozen(SquadStatus.Archived)).toBe(true);
    expect(isSelectionFrozen(SquadStatus.Draft)).toBe(false);
    expect(isSelectionFrozen(SquadStatus.Published)).toBe(false);
  });
});
