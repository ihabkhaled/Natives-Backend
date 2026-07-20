import { FixtureStatus, FixtureTransition } from '../model/competitions.enums';

/**
 * Pure lifecycle state machine for a fixture
 * (SCHEDULED → RESCHEDULED → READY → LIVE → FINAL, with ABANDONED and CANCELLED
 * as terminal off-ramps). Rescheduling is a distinct guarded operation
 * (`canReschedule`) that stamps a new instant; the generic transition verbs cover
 * ready/start/finalize/abandon/cancel. Cancellation keeps the fixture for history.
 * No side effects, no time, no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<FixtureStatus, readonly FixtureStatus[]> =
  new Map([
    [FixtureStatus.Scheduled, [FixtureStatus.Ready, FixtureStatus.Cancelled]],
    [FixtureStatus.Rescheduled, [FixtureStatus.Ready, FixtureStatus.Cancelled]],
    [
      FixtureStatus.Ready,
      [FixtureStatus.Live, FixtureStatus.Abandoned, FixtureStatus.Cancelled],
    ],
    [FixtureStatus.Live, [FixtureStatus.Final, FixtureStatus.Abandoned]],
    [FixtureStatus.Final, []],
    [FixtureStatus.Abandoned, []],
    [FixtureStatus.Cancelled, []],
  ]);

/** States from which a fixture may be rescheduled (moves it to RESCHEDULED). */
const RESCHEDULABLE: readonly FixtureStatus[] = [
  FixtureStatus.Scheduled,
  FixtureStatus.Rescheduled,
  FixtureStatus.Ready,
];

/** The set of states reachable from `from` via a generic transition verb. */
export function allowedFixtureTransitions(
  from: FixtureStatus,
): readonly FixtureStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted generic transition. */
export function canTransitionFixture(
  from: FixtureStatus,
  to: FixtureStatus,
): boolean {
  return allowedFixtureTransitions(from).includes(to);
}

/** True when a fixture in `from` may be rescheduled to a new instant. */
export function canReschedule(from: FixtureStatus): boolean {
  return RESCHEDULABLE.includes(from);
}

/** Map a requested transition verb to the status it targets. */
export function resolveFixtureTarget(
  transition: FixtureTransition,
): FixtureStatus {
  if (transition === FixtureTransition.Ready) {
    return FixtureStatus.Ready;
  }
  if (transition === FixtureTransition.Start) {
    return FixtureStatus.Live;
  }
  if (transition === FixtureTransition.Finalize) {
    return FixtureStatus.Final;
  }
  if (transition === FixtureTransition.Abandon) {
    return FixtureStatus.Abandoned;
  }
  return FixtureStatus.Cancelled;
}

/** Finalizing or abandoning stamps a settled instant. */
export function isFinalizeTarget(target: FixtureStatus): boolean {
  return target === FixtureStatus.Final || target === FixtureStatus.Abandoned;
}

/** Cancellation stamps a cancellation instant and requires a reason. */
export function isFixtureCancelTarget(target: FixtureStatus): boolean {
  return target === FixtureStatus.Cancelled;
}
