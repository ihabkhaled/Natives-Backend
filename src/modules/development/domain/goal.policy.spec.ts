import { describe, expect, it } from 'vitest';

import { DevelopmentValidationError } from '../errors/development-validation.error';
import { GoalStatus } from '../model/goal.enums';
import type { GoalContent } from '../model/goal.types';
import { assertGoalContent, isGoalOverdue } from './goal.policy';

function content(overrides: Partial<GoalContent> = {}): GoalContent {
  return {
    feedbackId: null,
    metricDefinitionId: null,
    ownerUserId: null,
    title: 'Improve backhand',
    description: null,
    measurableTarget: null,
    targetValue: null,
    baselineValue: null,
    progressValue: null,
    progressNote: null,
    evidence: null,
    dueDate: null,
    actions: [],
    ...overrides,
  };
}

describe('assertGoalContent', () => {
  it('accepts a valid goal with finite numerics and ordered actions', () => {
    expect(() =>
      assertGoalContent(
        content({
          targetValue: 10,
          baselineValue: 0,
          progressValue: null,
          actions: [
            { description: 'drill', sortOrder: 0, done: false, dueDate: null },
            { description: 'film', sortOrder: 1, done: true, dueDate: null },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it('rejects a blank title', () => {
    expect(() => assertGoalContent(content({ title: ' ' }))).toThrow(
      DevelopmentValidationError,
    );
  });

  it('rejects a non-finite numeric value', () => {
    expect(() =>
      assertGoalContent(content({ targetValue: Number.POSITIVE_INFINITY })),
    ).toThrow(DevelopmentValidationError);
  });

  it('rejects an out-of-range numeric value', () => {
    expect(() =>
      assertGoalContent(content({ baselineValue: 5_000_000_000 })),
    ).toThrow(DevelopmentValidationError);
  });

  it('rejects a blank action description', () => {
    expect(() =>
      assertGoalContent(
        content({
          actions: [
            { description: '  ', sortOrder: 0, done: false, dueDate: null },
          ],
        }),
      ),
    ).toThrow(DevelopmentValidationError);
  });

  it('rejects a non-integer action ordering key', () => {
    expect(() =>
      assertGoalContent(
        content({
          actions: [
            { description: 'x', sortOrder: 1.5, done: false, dueDate: null },
          ],
        }),
      ),
    ).toThrow(DevelopmentValidationError);
  });

  it('rejects duplicate action ordering keys', () => {
    expect(() =>
      assertGoalContent(
        content({
          actions: [
            { description: 'a', sortOrder: 0, done: false, dueDate: null },
            { description: 'b', sortOrder: 0, done: false, dueDate: null },
          ],
        }),
      ),
    ).toThrow(DevelopmentValidationError);
  });
});

describe('isGoalOverdue', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('is true for an active goal past its due date', () => {
    expect(isGoalOverdue(GoalStatus.Active, '2026-06-14', now)).toBe(true);
  });

  it('is false for an active goal due today or later', () => {
    expect(isGoalOverdue(GoalStatus.Active, '2026-06-15', now)).toBe(false);
    expect(isGoalOverdue(GoalStatus.Active, '2026-07-01', now)).toBe(false);
  });

  it('is false when the goal has no due date', () => {
    expect(isGoalOverdue(GoalStatus.Active, null, now)).toBe(false);
  });

  it('is false when the goal is not active', () => {
    expect(isGoalOverdue(GoalStatus.Proposed, '2026-01-01', now)).toBe(false);
  });
});
