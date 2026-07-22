import {
  NUMBER_MAX,
  NUMBER_MIN,
  PRINTED_NAME_MAX_LENGTH,
  PRINTED_NAME_PATTERN,
  QUANTITY_MAX,
  QUANTITY_MIN,
} from '../model/jerseys.constants';
import { ApparelValidationCode, JerseyDivision } from '../model/jerseys.enums';
import type {
  ApparelVerdict,
  ApparelViolation,
  OrderItemContent,
} from '../model/jerseys.types';

/**
 * Pure apparel validation (UN-604).
 *
 * Every rule is explainable: a size must be chosen, a number must be in range
 * when given, a customized item must carry a printable name, the requested
 * division must not contradict a division-specific product, and the quantity
 * must be within bounds. A blank number is allowed (a training top may have no
 * number); an out-of-range one is a violation, never silently clamped.
 */
export function validateOrderItem(
  content: OrderItemContent,
  productDivision: JerseyDivision,
  customizable: boolean,
): ApparelVerdict {
  const violations: ApparelViolation[] = [];
  collectNumber(content.number, violations);
  collectPrintedName(content, customizable, violations);
  collectDivision(content.division, productDivision, violations);
  collectQuantity(content.quantity, violations);
  return { valid: violations.length === 0, violations };
}

export function collectNumber(
  value: number | null,
  violations: ApparelViolation[],
): void {
  if (value !== null && (value < NUMBER_MIN || value > NUMBER_MAX)) {
    violations.push({ code: ApparelValidationCode.InvalidNumber });
  }
}

export function collectPrintedName(
  content: OrderItemContent,
  customizable: boolean,
  violations: ApparelViolation[],
): void {
  if (!customizable || content.printedName === null) {
    return;
  }
  if (!isPrintableName(content.printedName)) {
    violations.push({ code: ApparelValidationCode.MissingPrintedName });
  }
}

/**
 * A division-specific product (women / open) refuses a contradictory request.
 * A `mixed` product accepts any requested division, which is what makes a shared
 * kit orderable by everyone.
 */
export function collectDivision(
  requested: JerseyDivision,
  productDivision: JerseyDivision,
  violations: ApparelViolation[],
): void {
  if (productDivision === JerseyDivision.Mixed) {
    return;
  }
  if (requested !== productDivision && requested !== JerseyDivision.Mixed) {
    violations.push({ code: ApparelValidationCode.DivisionMismatch });
  }
}

export function collectQuantity(
  quantity: number,
  violations: ApparelViolation[],
): void {
  if (quantity < QUANTITY_MIN || quantity > QUANTITY_MAX) {
    violations.push({ code: ApparelValidationCode.QuantityOutOfRange });
  }
}

/** Whether a printed name is non-empty, short enough, and in the safe charset. */
export function isPrintableName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > PRINTED_NAME_MAX_LENGTH) {
    return false;
  }
  return PRINTED_NAME_PATTERN.test(trimmed);
}
