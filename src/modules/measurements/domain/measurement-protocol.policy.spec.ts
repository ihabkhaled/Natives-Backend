import { describe, expect, it } from 'vitest';

import { MeasurementValidationError } from '../errors/measurement-validation.error';
import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ResultPolicy,
} from '../model/measurements.enums';
import type { ProtocolContent } from '../model/measurements.types';
import { assertProtocolContent } from './measurement-protocol.policy';

function content(overrides: Partial<ProtocolContent> = {}): ProtocolContent {
  return {
    protocolKey: 'sprint_20m',
    name: '20 m sprint',
    description: null,
    seasonId: null,
    discipline: MeasurementDiscipline.Speed,
    unit: MeasurementUnit.Seconds,
    direction: MeasurementDirection.BetterLower,
    resultPolicy: ResultPolicy.Best,
    instructions: null,
    safetyNotes: null,
    minValue: null,
    maxValue: null,
    ...overrides,
  };
}

describe('assertProtocolContent', () => {
  it('accepts a valid definition', () => {
    expect(() =>
      assertProtocolContent(content({ minValue: 0, maxValue: 60 })),
    ).not.toThrow();
  });

  it('rejects a too-short or too-long key', () => {
    expect(() => assertProtocolContent(content({ protocolKey: 'a' }))).toThrow(
      MeasurementValidationError,
    );
    expect(() =>
      assertProtocolContent(content({ protocolKey: 'x'.repeat(101) })),
    ).toThrow(MeasurementValidationError);
  });

  it('rejects a blank name', () => {
    expect(() => assertProtocolContent(content({ name: ' ' }))).toThrow(
      MeasurementValidationError,
    );
  });

  it('rejects a non-finite or out-of-range bound', () => {
    expect(() =>
      assertProtocolContent(content({ minValue: Number.POSITIVE_INFINITY })),
    ).toThrow(MeasurementValidationError);
    expect(() =>
      assertProtocolContent(content({ maxValue: 9_000_000 })),
    ).toThrow(MeasurementValidationError);
  });

  it('rejects a min that is not below the max', () => {
    expect(() =>
      assertProtocolContent(content({ minValue: 10, maxValue: 10 })),
    ).toThrow(MeasurementValidationError);
  });

  it('accepts a single-sided bound', () => {
    expect(() =>
      assertProtocolContent(content({ minValue: 0, maxValue: null })),
    ).not.toThrow();
    expect(() =>
      assertProtocolContent(content({ minValue: null, maxValue: 100 })),
    ).not.toThrow();
  });
});
