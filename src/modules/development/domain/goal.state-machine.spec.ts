import { describe, expect, it } from 'vitest';

import { GoalStatus, GoalTransition } from '../model/goal.enums';
import {
  allowedGoalTransitions,
  canTransitionGoal,
  isGoalCompletion,
  isGoalOpen,
  resolveGoalTarget,
} from './goal.state-machine';

describe('goal state machine', () => {
  it('exposes the allowed transitions per state', () => {
    expect(allowedGoalTransitions(GoalStatus.Proposed)).toEqual([
      GoalStatus.Active,
      GoalStatus.Cancelled,
    ]);
    expect(allowedGoalTransitions(GoalStatus.Active)).toEqual([
      GoalStatus.Achieved,
      GoalStatus.Missed,
      GoalStatus.Cancelled,
    ]);
    expect(allowedGoalTransitions(GoalStatus.Achieved)).toEqual([
      GoalStatus.Active,
    ]);
    expect(allowedGoalTransitions(GoalStatus.Missed)).toEqual([
      GoalStatus.Active,
    ]);
    expect(allowedGoalTransitions(GoalStatus.Cancelled)).toEqual([
      GoalStatus.Active,
    ]);
  });

  it('permits only the modelled transitions', () => {
    expect(canTransitionGoal(GoalStatus.Proposed, GoalStatus.Active)).toBe(
      true,
    );
    expect(canTransitionGoal(GoalStatus.Active, GoalStatus.Achieved)).toBe(
      true,
    );
    expect(canTransitionGoal(GoalStatus.Proposed, GoalStatus.Achieved)).toBe(
      false,
    );
  });

  it('resolves a transition verb to its target status', () => {
    expect(resolveGoalTarget(GoalTransition.Activate)).toBe(GoalStatus.Active);
    expect(resolveGoalTarget(GoalTransition.Achieve)).toBe(GoalStatus.Achieved);
    expect(resolveGoalTarget(GoalTransition.Miss)).toBe(GoalStatus.Missed);
    expect(resolveGoalTarget(GoalTransition.Cancel)).toBe(GoalStatus.Cancelled);
    expect(resolveGoalTarget(GoalTransition.Reopen)).toBe(GoalStatus.Active);
  });

  it('marks only achievement as a completion', () => {
    expect(isGoalCompletion(GoalStatus.Achieved)).toBe(true);
    expect(isGoalCompletion(GoalStatus.Missed)).toBe(false);
    expect(isGoalCompletion(GoalStatus.Active)).toBe(false);
  });

  it('treats proposed and active goals as open', () => {
    expect(isGoalOpen(GoalStatus.Proposed)).toBe(true);
    expect(isGoalOpen(GoalStatus.Active)).toBe(true);
    expect(isGoalOpen(GoalStatus.Achieved)).toBe(false);
  });
});
