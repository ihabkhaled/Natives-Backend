import { MeasurementValidationError } from '../errors/measurement-validation.error';
import {
  ATTEMPT_VALUE_MAX,
  ATTEMPT_VALUE_MIN,
  ATTEMPTS_MAX_ITEMS,
  ATTEMPTS_MIN_ITEMS,
} from '../model/measurements.constants';
import type {
  AttemptInput,
  MeasurementProtocol,
} from '../model/measurements.types';
import { convertValue } from './unit-conversion.policy';

/**
 * Pure validation of a batch of raw attempts against their protocol. Enforces the
 * bounded batch size, unit compatibility with the protocol (via the conversion
 * policy, which rejects a cross-dimension unit), the recordable value range, the
 * protocol's optional sanity bounds on the converted canonical value, and that a
 * disqualified attempt carries a reason. A null value is allowed and left null —
 * a missing attempt is never coerced to zero. Every branch is unit-tested.
 */
export function assertAttempts(
  attempts: readonly AttemptInput[],
  protocol: MeasurementProtocol,
): void {
  if (
    attempts.length < ATTEMPTS_MIN_ITEMS ||
    attempts.length > ATTEMPTS_MAX_ITEMS
  ) {
    throw new MeasurementValidationError();
  }
  for (const attempt of attempts) {
    assertAttempt(attempt, protocol);
  }
}

function assertAttempt(
  attempt: AttemptInput,
  protocol: MeasurementProtocol,
): void {
  const canonical = convertValue(attempt.value, attempt.unit, protocol.unit);
  assertValue(attempt.value, canonical, protocol);
  if (attempt.disqualified && trimmed(attempt.dqReason).length === 0) {
    throw new MeasurementValidationError();
  }
}

function assertValue(
  rawValue: number | null,
  canonical: number | null,
  protocol: MeasurementProtocol,
): void {
  if (rawValue === null || canonical === null) {
    return;
  }
  if (
    !Number.isFinite(rawValue) ||
    rawValue < ATTEMPT_VALUE_MIN ||
    rawValue > ATTEMPT_VALUE_MAX
  ) {
    throw new MeasurementValidationError();
  }
  assertWithinBounds(canonical, protocol);
}

function assertWithinBounds(
  canonical: number,
  protocol: MeasurementProtocol,
): void {
  if (protocol.minValue !== null && canonical < protocol.minValue) {
    throw new MeasurementValidationError();
  }
  if (protocol.maxValue !== null && canonical > protocol.maxValue) {
    throw new MeasurementValidationError();
  }
}

function trimmed(value: string | null): string {
  return value === null ? '' : value.trim();
}
