import { describe, expect, it } from 'vitest';

import { FixtureStatus, FixtureTransition } from '../model/competitions.enums';
import {
  allowedFixtureTransitions,
  canReschedule,
  canTransitionFixture,
  isFinalizeTarget,
  isFixtureCancelTarget,
  resolveFixtureTarget,
} from './fixture.state-machine';

describe('fixture state machine', () => {
  it('permits the forward lifecycle', () => {
    expect(
      canTransitionFixture(FixtureStatus.Scheduled, FixtureStatus.Ready),
    ).toBe(true);
    expect(canTransitionFixture(FixtureStatus.Ready, FixtureStatus.Live)).toBe(
      true,
    );
    expect(canTransitionFixture(FixtureStatus.Live, FixtureStatus.Final)).toBe(
      true,
    );
  });

  it('permits abandonment and cancellation off-ramps', () => {
    expect(
      canTransitionFixture(FixtureStatus.Ready, FixtureStatus.Abandoned),
    ).toBe(true);
    expect(
      canTransitionFixture(FixtureStatus.Live, FixtureStatus.Abandoned),
    ).toBe(true);
    expect(
      canTransitionFixture(FixtureStatus.Scheduled, FixtureStatus.Cancelled),
    ).toBe(true);
    expect(
      canTransitionFixture(FixtureStatus.Rescheduled, FixtureStatus.Cancelled),
    ).toBe(true);
  });

  it('forbids skipping states and any move out of a terminal state', () => {
    expect(
      canTransitionFixture(FixtureStatus.Scheduled, FixtureStatus.Live),
    ).toBe(false);
    expect(canTransitionFixture(FixtureStatus.Final, FixtureStatus.Live)).toBe(
      false,
    );
    expect(allowedFixtureTransitions(FixtureStatus.Final)).toHaveLength(0);
    expect(allowedFixtureTransitions(FixtureStatus.Abandoned)).toHaveLength(0);
    expect(allowedFixtureTransitions(FixtureStatus.Cancelled)).toHaveLength(0);
  });

  it('allows rescheduling only before play begins', () => {
    expect(canReschedule(FixtureStatus.Scheduled)).toBe(true);
    expect(canReschedule(FixtureStatus.Rescheduled)).toBe(true);
    expect(canReschedule(FixtureStatus.Ready)).toBe(true);
    expect(canReschedule(FixtureStatus.Live)).toBe(false);
    expect(canReschedule(FixtureStatus.Final)).toBe(false);
    expect(canReschedule(FixtureStatus.Cancelled)).toBe(false);
  });

  it('maps every transition verb to its target status', () => {
    expect(resolveFixtureTarget(FixtureTransition.Ready)).toBe(
      FixtureStatus.Ready,
    );
    expect(resolveFixtureTarget(FixtureTransition.Start)).toBe(
      FixtureStatus.Live,
    );
    expect(resolveFixtureTarget(FixtureTransition.Finalize)).toBe(
      FixtureStatus.Final,
    );
    expect(resolveFixtureTarget(FixtureTransition.Abandon)).toBe(
      FixtureStatus.Abandoned,
    );
    expect(resolveFixtureTarget(FixtureTransition.Cancel)).toBe(
      FixtureStatus.Cancelled,
    );
  });

  it('flags targets that stamp instants or require a reason', () => {
    expect(isFinalizeTarget(FixtureStatus.Final)).toBe(true);
    expect(isFinalizeTarget(FixtureStatus.Abandoned)).toBe(true);
    expect(isFinalizeTarget(FixtureStatus.Ready)).toBe(false);
    expect(isFixtureCancelTarget(FixtureStatus.Cancelled)).toBe(true);
    expect(isFixtureCancelTarget(FixtureStatus.Final)).toBe(false);
  });
});
