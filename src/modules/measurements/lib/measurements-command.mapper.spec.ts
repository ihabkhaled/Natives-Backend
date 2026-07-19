import { describe, expect, it } from 'vitest';

import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ResultPolicy,
} from '../model/measurements.enums';
import type {
  ProtocolContentInput,
  SessionContentInput,
} from '../model/measurements.types';
import {
  toAttemptInputs,
  toProtocolContent,
  toSessionContent,
} from './measurements-command.mapper';

describe('toProtocolContent', () => {
  it('fills absent optionals with null', () => {
    const input: ProtocolContentInput = {
      protocolKey: 'vertical_jump',
      name: 'Vertical jump',
      discipline: MeasurementDiscipline.Jumping,
      unit: MeasurementUnit.Centimeters,
      direction: MeasurementDirection.BetterHigher,
      resultPolicy: ResultPolicy.Best,
    };
    expect(toProtocolContent(input)).toEqual({
      protocolKey: 'vertical_jump',
      name: 'Vertical jump',
      description: null,
      seasonId: null,
      discipline: MeasurementDiscipline.Jumping,
      unit: MeasurementUnit.Centimeters,
      direction: MeasurementDirection.BetterHigher,
      resultPolicy: ResultPolicy.Best,
      instructions: null,
      safetyNotes: null,
      minValue: null,
      maxValue: null,
    });
  });

  it('preserves provided optionals', () => {
    const content = toProtocolContent({
      protocolKey: 'k',
      name: 'n',
      description: 'd',
      seasonId: 'season-1',
      discipline: MeasurementDiscipline.Custom,
      unit: MeasurementUnit.Count,
      direction: MeasurementDirection.BetterHigher,
      resultPolicy: ResultPolicy.Average,
      instructions: 'i',
      safetyNotes: 's',
      minValue: 0,
      maxValue: 10,
    });
    expect(content.minValue).toBe(0);
    expect(content.maxValue).toBe(10);
    expect(content.seasonId).toBe('season-1');
  });
});

describe('toSessionContent', () => {
  it('fills absent optionals with null', () => {
    const input: SessionContentInput = {
      title: 'Combine',
      scheduledAt: '2026-06-01T09:00:00.000Z',
    };
    expect(toSessionContent(input)).toEqual({
      title: 'Combine',
      seasonId: null,
      scheduledAt: '2026-06-01T09:00:00.000Z',
      location: null,
      conditions: null,
      notes: null,
    });
  });
});

describe('toAttemptInputs', () => {
  it('applies the documented defaults for missing fields', () => {
    const [attempt] = toAttemptInputs([{ unit: MeasurementUnit.Seconds }]);
    expect(attempt).toEqual({
      value: null,
      unit: MeasurementUnit.Seconds,
      valid: true,
      disqualified: false,
      dqReason: null,
      notes: null,
    });
  });

  it('preserves provided fields including a null value', () => {
    const [attempt] = toAttemptInputs([
      {
        value: 4.2,
        unit: MeasurementUnit.Seconds,
        valid: false,
        disqualified: true,
        dqReason: 'false start',
        notes: 'windy',
      },
    ]);
    expect(attempt).toMatchObject({
      value: 4.2,
      valid: false,
      disqualified: true,
      dqReason: 'false start',
    });
  });
});
