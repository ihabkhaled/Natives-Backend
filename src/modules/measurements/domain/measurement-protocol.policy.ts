import { MeasurementValidationError } from '../errors/measurement-validation.error';
import {
  PROTOCOL_KEY_MAX_LENGTH,
  PROTOCOL_KEY_MIN_LENGTH,
  PROTOCOL_NAME_MIN_LENGTH,
  PROTOCOL_VALUE_MAX,
  PROTOCOL_VALUE_MIN,
} from '../model/measurements.constants';
import type { ProtocolContent } from '../model/measurements.types';

/**
 * Pure validation of a measurement-protocol definition. Guards the key/name
 * shape and the optional sanity-bound window (min < max, both finite, within the
 * catalog range). The enum-valued fields (discipline/unit/direction/policy) are
 * closed by the DTO and the database check constraints; this enforces the
 * invariants the recorder relies on. No side effects — every branch is unit-tested.
 */
export function assertProtocolContent(content: ProtocolContent): void {
  const key = content.protocolKey.trim();
  if (
    key.length < PROTOCOL_KEY_MIN_LENGTH ||
    key.length > PROTOCOL_KEY_MAX_LENGTH
  ) {
    throw new MeasurementValidationError();
  }
  if (content.name.trim().length < PROTOCOL_NAME_MIN_LENGTH) {
    throw new MeasurementValidationError();
  }
  assertBounds(content.minValue, content.maxValue);
}

function assertBounds(minValue: number | null, maxValue: number | null): void {
  assertBound(minValue);
  assertBound(maxValue);
  if (minValue !== null && maxValue !== null && minValue >= maxValue) {
    throw new MeasurementValidationError();
  }
}

function assertBound(value: number | null): void {
  if (value === null) {
    return;
  }
  if (
    !Number.isFinite(value) ||
    value < PROTOCOL_VALUE_MIN ||
    value > PROTOCOL_VALUE_MAX
  ) {
    throw new MeasurementValidationError();
  }
}
