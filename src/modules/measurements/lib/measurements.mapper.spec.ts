import { describe, expect, it } from 'vitest';

import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ProtocolStatus,
  ResultPolicy,
  SessionStatus,
} from '../model/measurements.enums';
import type {
  MeasurementAttemptRow,
  MeasurementProtocolRow,
  MeasurementSessionRow,
} from '../model/measurements.rows';
import {
  toMeasurementAttempt,
  toMeasurementProtocol,
  toMeasurementSession,
} from './measurements.mapper';

function protocolRow(
  overrides: Partial<MeasurementProtocolRow> = {},
): MeasurementProtocolRow {
  return {
    id: 'protocol-1',
    team_id: null,
    season_id: null,
    protocol_key: 'sprint_20m',
    name: '20 m sprint',
    description: null,
    discipline: 'speed',
    unit: 'seconds',
    direction: 'better_lower',
    result_policy: 'best',
    instructions: null,
    safety_notes: null,
    min_value: null,
    max_value: '60',
    status: 'active',
    record_version: 1,
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toMeasurementProtocol', () => {
  it('maps a raw row into the domain protocol', () => {
    const protocol = toMeasurementProtocol(protocolRow());
    expect(protocol.discipline).toBe(MeasurementDiscipline.Speed);
    expect(protocol.unit).toBe(MeasurementUnit.Seconds);
    expect(protocol.direction).toBe(MeasurementDirection.BetterLower);
    expect(protocol.resultPolicy).toBe(ResultPolicy.Best);
    expect(protocol.status).toBe(ProtocolStatus.Active);
    expect(protocol.minValue).toBeNull();
    expect(protocol.maxValue).toBe(60);
  });
});

describe('toMeasurementSession', () => {
  it('maps a raw row and a null conducted_at', () => {
    const row: MeasurementSessionRow = {
      id: 'session-1',
      team_id: 'team-1',
      season_id: null,
      title: 'Combine',
      status: 'scheduled',
      scheduled_at: '2026-06-01T09:00:00.000Z',
      conducted_at: null,
      location: null,
      conditions: null,
      notes: null,
      record_version: 1,
      created_by: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const session = toMeasurementSession(row);
    expect(session.status).toBe(SessionStatus.Scheduled);
    expect(session.conductedAt).toBeNull();
    expect(session.scheduledAt.getTime()).toBe(
      new Date('2026-06-01T09:00:00.000Z').getTime(),
    );
  });
});

describe('toMeasurementAttempt', () => {
  it('maps a missing attempt as null (never zero)', () => {
    const row: MeasurementAttemptRow = {
      id: 'attempt-1',
      session_id: 'session-1',
      team_id: 'team-1',
      membership_id: 'member-1',
      protocol_id: 'protocol-1',
      attempt_number: 1,
      raw_value: null,
      unit: 'seconds',
      canonical_value: null,
      valid: true,
      disqualified: false,
      dq_reason: null,
      evaluator_user_id: null,
      notes: null,
      recorded_at: '2026-06-01T09:00:00.000Z',
      created_at: '2026-06-01T09:00:00.000Z',
    };
    const attempt = toMeasurementAttempt(row);
    expect(attempt.rawValue).toBeNull();
    expect(attempt.canonicalValue).toBeNull();
    expect(attempt.unit).toBe(MeasurementUnit.Seconds);
  });

  it('maps a measured attempt with values', () => {
    const attempt = toMeasurementAttempt({
      id: 'attempt-2',
      session_id: 'session-1',
      team_id: 'team-1',
      membership_id: 'member-1',
      protocol_id: 'protocol-1',
      attempt_number: 2,
      raw_value: '320',
      unit: 'milliseconds',
      canonical_value: '0.32',
      valid: true,
      disqualified: false,
      dq_reason: null,
      evaluator_user_id: 'coach-1',
      notes: 'clean',
      recorded_at: '2026-06-01T09:00:00.000Z',
      created_at: '2026-06-01T09:00:00.000Z',
    });
    expect(attempt.rawValue).toBe(320);
    expect(attempt.canonicalValue).toBe(0.32);
    expect(attempt.evaluatorUserId).toBe('coach-1');
  });
});
