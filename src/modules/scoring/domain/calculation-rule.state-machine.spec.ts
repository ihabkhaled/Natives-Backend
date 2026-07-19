import { describe, expect, it } from 'vitest';

import {
  CalculationRuleStatus,
  CalculationRuleTransition,
} from '../model/scoring.enums';
import {
  allowedRuleTransitions,
  canTransitionRule,
  isPublishTarget,
  isRetireTarget,
  isRuleEditable,
  resolveRuleTarget,
} from './calculation-rule.state-machine';

describe('calculation-rule.state-machine', () => {
  it('permits only the modelled transitions', () => {
    expect(
      canTransitionRule(
        CalculationRuleStatus.Draft,
        CalculationRuleStatus.Approved,
      ),
    ).toBe(true);
    expect(
      canTransitionRule(
        CalculationRuleStatus.Approved,
        CalculationRuleStatus.Published,
      ),
    ).toBe(true);
    expect(
      canTransitionRule(
        CalculationRuleStatus.Approved,
        CalculationRuleStatus.Draft,
      ),
    ).toBe(true);
    expect(
      canTransitionRule(
        CalculationRuleStatus.Published,
        CalculationRuleStatus.Retired,
      ),
    ).toBe(true);
  });

  it('forbids illegal transitions', () => {
    expect(
      canTransitionRule(
        CalculationRuleStatus.Draft,
        CalculationRuleStatus.Published,
      ),
    ).toBe(false);
    expect(
      canTransitionRule(
        CalculationRuleStatus.Published,
        CalculationRuleStatus.Draft,
      ),
    ).toBe(false);
    expect(allowedRuleTransitions(CalculationRuleStatus.Retired)).toEqual([]);
    expect(allowedRuleTransitions('unknown' as CalculationRuleStatus)).toEqual(
      [],
    );
  });

  it('resolves each transition verb to its target status', () => {
    expect(resolveRuleTarget(CalculationRuleTransition.Approve)).toBe(
      CalculationRuleStatus.Approved,
    );
    expect(resolveRuleTarget(CalculationRuleTransition.Publish)).toBe(
      CalculationRuleStatus.Published,
    );
    expect(resolveRuleTarget(CalculationRuleTransition.Revert)).toBe(
      CalculationRuleStatus.Draft,
    );
    expect(resolveRuleTarget(CalculationRuleTransition.Retire)).toBe(
      CalculationRuleStatus.Retired,
    );
  });

  it('classifies editability and publish/retire targets', () => {
    expect(isRuleEditable(CalculationRuleStatus.Draft)).toBe(true);
    expect(isRuleEditable(CalculationRuleStatus.Approved)).toBe(false);
    expect(isPublishTarget(CalculationRuleStatus.Published)).toBe(true);
    expect(isPublishTarget(CalculationRuleStatus.Retired)).toBe(false);
    expect(isRetireTarget(CalculationRuleStatus.Retired)).toBe(true);
    expect(isRetireTarget(CalculationRuleStatus.Published)).toBe(false);
  });
});
