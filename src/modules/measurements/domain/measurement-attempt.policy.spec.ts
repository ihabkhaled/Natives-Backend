import { describe, expect, it } from 'vitest';

import { MeasurementValidationError } from '../errors/measurement-validation.error';
import { UnitIncompatibleError } from '../errors/unit-incompatible.error';
import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ProtocolStatus,
  ResultPolicy,
} from '../model/measurements.enums';
import type {
  AttemptInput,
  MeasurementProtocol,
} from '../model/measurements.types';
import { assertAttempts } from './measurement-attempt.policy';

function protocol(
  overrides: Partial<MeasurementProtocol> = {},
): MeasurementProtocol {
  return {
    id: 'protocol-1',
    teamId: 'team-1',
    seasonId: null,
    protocolKey: 'sprint_20m',
    name: '20 m sprint',
    description: null,
    discipline: MeasurementDiscipline.Speed,
    unit: MeasurementUnit.Seconds,
    direction: MeasurementDirection.BetterLower,
    resultPolicy: ResultPolicy.Best,
    instructions: null,
    safetyNotes: null,
    minValue: 0,
    maxValue: 60,
    status: ProtocolStatus.Active,
    recordVersion: 1,
    createdBy: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function attempt(overrides: Partial<AttemptInput> = {}): AttemptInput {
  return {
    value: 3.2,
    unit: MeasurementUnit.Seconds,
    valid: true,
    disqualified: false,
    dqReason: null,
    notes: null,
    ...overrides,
  };
}

describe('assertAttempts', () => {
  it('accepts a bounded batch of valid attempts', () => {
    expect(() => assertAttempts([attempt()], protocol())).not.toThrow();
  });

  it('rejects an empty or oversized batch', () => {
    expect(() => assertAttempts([], protocol())).toThrow(
      MeasurementValidationError,
    );
    const many = Array.from({ length: 21 }, () => attempt());
    expect(() => assertAttempts(many, protocol())).toThrow(
      MeasurementValidationError,
    );
  });

  it('rejects a unit from a different dimension', () => {
    expect(() =>
      assertAttempts(
        [attempt({ value: 5, unit: MeasurementUnit.Meters })],
        protocol(),
      ),
    ).toThrow(UnitIncompatibleError);
  });

  it('rejects a value outside the recordable range', () => {
    expect(() =>
      assertAttempts([attempt({ value: 2_000_000 })], protocol()),
    ).toThrow(MeasurementValidationError);
  });

  it('rejects a value outside the protocol bounds', () => {
    expect(() => assertAttempts([attempt({ value: 90 })], protocol())).toThrow(
      MeasurementValidationError,
    );
    expect(() => assertAttempts([attempt({ value: -1 })], protocol())).toThrow(
      MeasurementValidationError,
    );
  });

  it('requires a reason for a disqualified attempt', () => {
    expect(() =>
      assertAttempts(
        [attempt({ disqualified: true, dqReason: null })],
        protocol(),
      ),
    ).toThrow(MeasurementValidationError);
    expect(() =>
      assertAttempts(
        [attempt({ disqualified: true, dqReason: ' ' })],
        protocol(),
      ),
    ).toThrow(MeasurementValidationError);
    expect(() =>
      assertAttempts(
        [attempt({ disqualified: true, dqReason: 'false start' })],
        protocol(),
      ),
    ).not.toThrow();
  });

  it('allows a null value as a missing attempt (never zero)', () => {
    expect(() =>
      assertAttempts([attempt({ value: null })], protocol()),
    ).not.toThrow();
  });

  it('accepts a value converted within bounds from another unit', () => {
    expect(() =>
      assertAttempts(
        [attempt({ value: 4000, unit: MeasurementUnit.Milliseconds })],
        protocol(),
      ),
    ).not.toThrow();
  });

  it('skips bound checks when the protocol has no bounds', () => {
    expect(() =>
      assertAttempts(
        [attempt({ value: 500 })],
        protocol({ minValue: null, maxValue: null }),
      ),
    ).not.toThrow();
  });
});
