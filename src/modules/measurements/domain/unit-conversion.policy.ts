import { UnitIncompatibleError } from '../errors/unit-incompatible.error';
import { UNIT_METADATA } from '../model/measurements.constants';
import type {
  MeasurementDimension,
  MeasurementUnit,
} from '../model/measurements.enums';
import type { UnitMetadata } from '../model/measurements.types';

/**
 * Pure unit conversion for objective measurements. Only units of the same
 * physical dimension are convertible; a cross-dimension request is a domain error,
 * never a silent coercion. Conversion goes through each unit's canonical factor
 * (value × factor(from) ÷ factor(to)), so metres↔centimetres and seconds↔
 * milliseconds are exact. Every branch is unit-tested.
 */
function metadataOf(unit: MeasurementUnit): UnitMetadata {
  const metadata = UNIT_METADATA.get(unit);
  if (metadata === undefined) {
    throw new UnitIncompatibleError();
  }
  return metadata;
}

export function dimensionOf(unit: MeasurementUnit): MeasurementDimension {
  return metadataOf(unit).dimension;
}

export function areUnitsCompatible(
  from: MeasurementUnit,
  to: MeasurementUnit,
): boolean {
  return dimensionOf(from) === dimensionOf(to);
}

/**
 * Convert `value` from one unit to another within the same dimension. A null
 * value stays null (a missing attempt is never converted into zero). An
 * incompatible pair throws so mismatched units can never be silently mixed.
 */
export function convertValue(
  value: number | null,
  from: MeasurementUnit,
  to: MeasurementUnit,
): number | null {
  if (!areUnitsCompatible(from, to)) {
    throw new UnitIncompatibleError();
  }
  if (value === null) {
    return null;
  }
  if (from === to) {
    return value;
  }
  return (value * metadataOf(from).factor) / metadataOf(to).factor;
}
