import { describe, expect, it } from 'vitest';

import { UnitIncompatibleError } from '../errors/unit-incompatible.error';
import {
  MeasurementDimension,
  MeasurementUnit,
} from '../model/measurements.enums';
import {
  areUnitsCompatible,
  convertValue,
  dimensionOf,
} from './unit-conversion.policy';

describe('dimensionOf', () => {
  it('maps each unit to its physical dimension', () => {
    expect(dimensionOf(MeasurementUnit.Milliseconds)).toBe(
      MeasurementDimension.Time,
    );
    expect(dimensionOf(MeasurementUnit.Centimeters)).toBe(
      MeasurementDimension.Distance,
    );
    expect(dimensionOf(MeasurementUnit.Level)).toBe(MeasurementDimension.Level);
  });

  it('throws for an unknown unit', () => {
    expect(() => dimensionOf('parsecs' as MeasurementUnit)).toThrow(
      UnitIncompatibleError,
    );
  });
});

describe('areUnitsCompatible', () => {
  it('is true within a dimension and false across dimensions', () => {
    expect(
      areUnitsCompatible(MeasurementUnit.Seconds, MeasurementUnit.Milliseconds),
    ).toBe(true);
    expect(
      areUnitsCompatible(MeasurementUnit.Seconds, MeasurementUnit.Meters),
    ).toBe(false);
  });
});

describe('convertValue', () => {
  it('throws when the units are incompatible', () => {
    expect(() =>
      convertValue(1, MeasurementUnit.Seconds, MeasurementUnit.Meters),
    ).toThrow(UnitIncompatibleError);
  });

  it('keeps a null value null (never zero)', () => {
    expect(
      convertValue(null, MeasurementUnit.Meters, MeasurementUnit.Centimeters),
    ).toBeNull();
  });

  it('returns the same value when the units match', () => {
    expect(
      convertValue(4.2, MeasurementUnit.Seconds, MeasurementUnit.Seconds),
    ).toBe(4.2);
  });

  it('converts exactly between units of the same dimension', () => {
    expect(
      convertValue(250, MeasurementUnit.Milliseconds, MeasurementUnit.Seconds),
    ).toBe(0.25);
    expect(
      convertValue(75, MeasurementUnit.Centimeters, MeasurementUnit.Meters),
    ).toBe(0.75);
    expect(
      convertValue(1.5, MeasurementUnit.Meters, MeasurementUnit.Centimeters),
    ).toBe(150);
  });
});
