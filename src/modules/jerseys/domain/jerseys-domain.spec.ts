import { describe, expect, it } from 'vitest';

import {
  ApparelValidationCode,
  JerseyDivision,
  JerseySize,
  KitType,
  OrderStatus,
  OrderTransition,
  SleeveType,
} from '../model/jerseys.enums';
import type { OrderItemContent } from '../model/jerseys.types';
import {
  collectDivision,
  isPrintableName,
  validateOrderItem,
} from './apparel-validation.policy';
import {
  canTransitionOrder,
  isApproveTarget,
  isCancelTarget,
  isCompleteTarget,
  isOrderEditable,
  isReceiveTarget,
  orderTargetOf,
} from './order.state-machine';

function item(overrides: Partial<OrderItemContent> = {}): OrderItemContent {
  return {
    productId: 'product-1',
    membershipId: null,
    kitType: KitType.Home,
    size: JerseySize.Medium,
    sleeves: SleeveType.Short,
    division: JerseyDivision.Open,
    printedName: 'ALI',
    number: 7,
    quantity: 1,
    ...overrides,
  };
}

describe('apparel validation policy', () => {
  it('accepts a well-formed customizable item', () => {
    expect(validateOrderItem(item(), JerseyDivision.Open, true).valid).toBe(
      true,
    );
  });

  it('allows a blank number but rejects an out-of-range one', () => {
    expect(
      validateOrderItem(item({ number: null }), JerseyDivision.Open, true)
        .valid,
    ).toBe(true);
    const verdict = validateOrderItem(
      item({ number: 1000 }),
      JerseyDivision.Open,
      true,
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.violations[0]?.code).toBe(
      ApparelValidationCode.InvalidNumber,
    );
  });

  it('rejects an unprintable name on a customizable product', () => {
    const verdict = validateOrderItem(
      item({ printedName: '###' }),
      JerseyDivision.Open,
      true,
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.violations[0]?.code).toBe(
      ApparelValidationCode.MissingPrintedName,
    );
  });

  it('ignores a printed name on a non-customizable product', () => {
    expect(
      validateOrderItem(
        item({ printedName: '###' }),
        JerseyDivision.Open,
        false,
      ).valid,
    ).toBe(true);
  });

  it('refuses a division that contradicts a division-specific product', () => {
    const violations: { code: ApparelValidationCode }[] = [];
    collectDivision(JerseyDivision.Open, JerseyDivision.Women, violations);
    expect(violations[0]?.code).toBe(ApparelValidationCode.DivisionMismatch);
    const mixed: { code: ApparelValidationCode }[] = [];
    collectDivision(JerseyDivision.Open, JerseyDivision.Mixed, mixed);
    expect(mixed).toHaveLength(0);
  });

  it('rejects an out-of-range quantity', () => {
    const verdict = validateOrderItem(
      item({ quantity: 0 }),
      JerseyDivision.Open,
      true,
    );
    expect(verdict.violations[0]?.code).toBe(
      ApparelValidationCode.QuantityOutOfRange,
    );
  });

  it('recognizes a printable name', () => {
    expect(isPrintableName('ALI')).toBe(true);
    expect(isPrintableName('  ')).toBe(false);
    expect(isPrintableName('A'.repeat(40))).toBe(false);
    expect(isPrintableName('bad$name')).toBe(false);
  });
});

describe('order state machine', () => {
  it('walks the full fulfillment path and refuses illegal moves', () => {
    expect(orderTargetOf(OrderTransition.Submit)).toBe(OrderStatus.Submitted);
    expect(orderTargetOf(OrderTransition.Complete)).toBe(OrderStatus.Completed);
    expect(canTransitionOrder(OrderStatus.Draft, OrderStatus.Submitted)).toBe(
      true,
    );
    expect(canTransitionOrder(OrderStatus.Draft, OrderStatus.Completed)).toBe(
      false,
    );
    expect(
      canTransitionOrder(OrderStatus.Completed, OrderStatus.Cancelled),
    ).toBe(false);
    expect(
      canTransitionOrder(OrderStatus.Received, OrderStatus.Cancelled),
    ).toBe(true);
  });

  it('allows item edits only in a draft', () => {
    expect(isOrderEditable(OrderStatus.Draft)).toBe(true);
    expect(isOrderEditable(OrderStatus.Submitted)).toBe(false);
    expect(isApproveTarget(OrderStatus.Approved)).toBe(true);
    expect(isReceiveTarget(OrderStatus.Received)).toBe(true);
    expect(isCompleteTarget(OrderStatus.Completed)).toBe(true);
    expect(isCancelTarget(OrderStatus.Cancelled)).toBe(true);
  });
});
