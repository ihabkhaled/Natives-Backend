import { describe, expect, it } from 'vitest';

import { PointsRuleStatus, PointsRuleTransition } from '../model/points.enums';
import {
  allowedRuleTransitions,
  canTransitionRule,
  isPublishTarget,
  isRetireTarget,
  resolveRuleTarget,
} from './points-rule.state-machine';

describe('points-rule state machine', () => {
  it('permits the forward lifecycle and revert', () => {
    expect(
      canTransitionRule(PointsRuleStatus.Draft, PointsRuleStatus.Approved),
    ).toBe(true);
    expect(
      canTransitionRule(PointsRuleStatus.Approved, PointsRuleStatus.Published),
    ).toBe(true);
    expect(
      canTransitionRule(PointsRuleStatus.Approved, PointsRuleStatus.Draft),
    ).toBe(true);
    expect(
      canTransitionRule(PointsRuleStatus.Published, PointsRuleStatus.Retired),
    ).toBe(true);
  });

  it('forbids skipping approval and any move out of retired', () => {
    expect(
      canTransitionRule(PointsRuleStatus.Draft, PointsRuleStatus.Published),
    ).toBe(false);
    expect(allowedRuleTransitions(PointsRuleStatus.Retired)).toHaveLength(0);
  });

  it('maps every transition verb to its target status', () => {
    expect(resolveRuleTarget(PointsRuleTransition.Approve)).toBe(
      PointsRuleStatus.Approved,
    );
    expect(resolveRuleTarget(PointsRuleTransition.Publish)).toBe(
      PointsRuleStatus.Published,
    );
    expect(resolveRuleTarget(PointsRuleTransition.Revert)).toBe(
      PointsRuleStatus.Draft,
    );
    expect(resolveRuleTarget(PointsRuleTransition.Retire)).toBe(
      PointsRuleStatus.Retired,
    );
  });

  it('flags publish and retire targets for instant stamping', () => {
    expect(isPublishTarget(PointsRuleStatus.Published)).toBe(true);
    expect(isPublishTarget(PointsRuleStatus.Approved)).toBe(false);
    expect(isRetireTarget(PointsRuleStatus.Retired)).toBe(true);
    expect(isRetireTarget(PointsRuleStatus.Published)).toBe(false);
  });
});
