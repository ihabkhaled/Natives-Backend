import { describe, expect, it } from 'vitest';

import { toFeedbackFields, toGoalContent } from './development-command.mapper';

describe('toFeedbackFields', () => {
  it('normalizes an absent input to all-null fields', () => {
    expect(toFeedbackFields(undefined)).toEqual({
      positiveFrisbee: null,
      frisbeeImprovement: null,
      positiveMental: null,
      mentalImprovement: null,
      teamRole: null,
      recommendedPosition: null,
      summary: null,
      coachNote: null,
    });
  });

  it('carries supplied fields including the coach note', () => {
    const fields = toFeedbackFields({
      positiveFrisbee: 'good',
      coachNote: 'private',
    });
    expect(fields.positiveFrisbee).toBe('good');
    expect(fields.coachNote).toBe('private');
    expect(fields.summary).toBeNull();
  });
});

describe('toGoalContent', () => {
  it('normalizes optional content and defaults actions', () => {
    const content = toGoalContent({ title: 'Goal' });
    expect(content.title).toBe('Goal');
    expect(content.targetValue).toBeNull();
    expect(content.dueDate).toBeNull();
    expect(content.actions).toEqual([]);
  });

  it('maps action steps with a default done flag', () => {
    const content = toGoalContent({
      title: 'Goal',
      targetValue: 5,
      actions: [{ description: 'drill', sortOrder: 2 }],
    });
    expect(content.targetValue).toBe(5);
    expect(content.actions).toEqual([
      { description: 'drill', sortOrder: 2, done: false, dueDate: null },
    ]);
  });
});
