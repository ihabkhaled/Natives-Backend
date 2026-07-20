import { describe, expect, it } from 'vitest';

import {
  CompetitionStatus,
  CompetitionTransition,
} from '../model/competitions.enums';
import {
  allowedCompetitionTransitions,
  canTransitionCompetition,
  isActivateTarget,
  isArchiveTarget,
  isCancelTarget,
  isCompleteTarget,
  isPublishTarget,
  resolveCompetitionTarget,
} from './competition.state-machine';

describe('competition state machine', () => {
  it('permits the forward lifecycle', () => {
    expect(
      canTransitionCompetition(
        CompetitionStatus.Draft,
        CompetitionStatus.Published,
      ),
    ).toBe(true);
    expect(
      canTransitionCompetition(
        CompetitionStatus.Published,
        CompetitionStatus.Active,
      ),
    ).toBe(true);
    expect(
      canTransitionCompetition(
        CompetitionStatus.Active,
        CompetitionStatus.Completed,
      ),
    ).toBe(true);
    expect(
      canTransitionCompetition(
        CompetitionStatus.Completed,
        CompetitionStatus.Archived,
      ),
    ).toBe(true);
  });

  it('permits cancellation from every live state and archival afterwards', () => {
    expect(
      canTransitionCompetition(
        CompetitionStatus.Draft,
        CompetitionStatus.Cancelled,
      ),
    ).toBe(true);
    expect(
      canTransitionCompetition(
        CompetitionStatus.Active,
        CompetitionStatus.Cancelled,
      ),
    ).toBe(true);
    expect(
      canTransitionCompetition(
        CompetitionStatus.Cancelled,
        CompetitionStatus.Archived,
      ),
    ).toBe(true);
  });

  it('forbids skipping states and any move out of archived', () => {
    expect(
      canTransitionCompetition(
        CompetitionStatus.Draft,
        CompetitionStatus.Active,
      ),
    ).toBe(false);
    expect(
      canTransitionCompetition(
        CompetitionStatus.Completed,
        CompetitionStatus.Cancelled,
      ),
    ).toBe(false);
    expect(
      allowedCompetitionTransitions(CompetitionStatus.Archived),
    ).toHaveLength(0);
  });

  it('maps every transition verb to its target status', () => {
    expect(resolveCompetitionTarget(CompetitionTransition.Publish)).toBe(
      CompetitionStatus.Published,
    );
    expect(resolveCompetitionTarget(CompetitionTransition.Activate)).toBe(
      CompetitionStatus.Active,
    );
    expect(resolveCompetitionTarget(CompetitionTransition.Complete)).toBe(
      CompetitionStatus.Completed,
    );
    expect(resolveCompetitionTarget(CompetitionTransition.Cancel)).toBe(
      CompetitionStatus.Cancelled,
    );
    expect(resolveCompetitionTarget(CompetitionTransition.Archive)).toBe(
      CompetitionStatus.Archived,
    );
  });

  it('flags each target that owns an instant or a reason', () => {
    expect(isPublishTarget(CompetitionStatus.Published)).toBe(true);
    expect(isPublishTarget(CompetitionStatus.Active)).toBe(false);
    expect(isActivateTarget(CompetitionStatus.Active)).toBe(true);
    expect(isActivateTarget(CompetitionStatus.Draft)).toBe(false);
    expect(isCompleteTarget(CompetitionStatus.Completed)).toBe(true);
    expect(isCompleteTarget(CompetitionStatus.Active)).toBe(false);
    expect(isCancelTarget(CompetitionStatus.Cancelled)).toBe(true);
    expect(isCancelTarget(CompetitionStatus.Archived)).toBe(false);
    expect(isArchiveTarget(CompetitionStatus.Archived)).toBe(true);
    expect(isArchiveTarget(CompetitionStatus.Completed)).toBe(false);
  });
});
