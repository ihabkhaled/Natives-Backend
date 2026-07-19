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
  AttemptInput,
  MeasurementAttempt,
  MeasurementProtocol,
  MeasurementSession,
  ProtocolContent,
  RecordMeasurementCommand,
  SessionContent,
} from '../model/measurements.types';
import {
  buildHistoryEntries,
  buildMeasurementRecordedEvent,
  buildNewAttempts,
  buildNewProtocol,
  buildNewSession,
  buildProtocolAudit,
  buildRecordAudit,
  buildRecordedMeasurement,
  buildSessionAudit,
  buildSessionStatusChange,
  selectProtocolResult,
  toSelectableAttempts,
} from './measurements.builders';

const NOW = new Date('2026-06-01T09:00:00.000Z');

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
    minValue: null,
    maxValue: null,
    status: ProtocolStatus.Active,
    recordVersion: 1,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function session(
  overrides: Partial<MeasurementSession> = {},
): MeasurementSession {
  return {
    id: 'session-1',
    teamId: 'team-1',
    seasonId: null,
    title: 'Combine',
    status: SessionStatus.Scheduled,
    scheduledAt: NOW,
    conductedAt: null,
    location: null,
    conditions: null,
    notes: null,
    recordVersion: 2,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function attemptRow(
  overrides: Partial<MeasurementAttempt> = {},
): MeasurementAttempt {
  return {
    id: 'attempt-1',
    sessionId: 'session-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    protocolId: 'protocol-1',
    attemptNumber: 1,
    rawValue: 3.2,
    unit: MeasurementUnit.Seconds,
    canonicalValue: 3.2,
    valid: true,
    disqualified: false,
    dqReason: null,
    evaluatorUserId: 'coach-1',
    notes: null,
    recordedAt: NOW,
    createdAt: NOW,
    ...overrides,
  };
}

function attemptInput(overrides: Partial<AttemptInput> = {}): AttemptInput {
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

function command(attempts: readonly AttemptInput[]): RecordMeasurementCommand {
  return { membershipId: 'member-1', protocolId: 'protocol-1', attempts };
}

describe('buildNewProtocol / buildNewSession', () => {
  it('wraps content with id, actor, and timestamp', () => {
    const content = {} as ProtocolContent;
    expect(buildNewProtocol('id-1', 'team-1', content, 'actor-1', NOW)).toEqual(
      {
        id: 'id-1',
        teamId: 'team-1',
        content,
        createdBy: 'actor-1',
        now: NOW,
      },
    );
    const sessionContent = {} as SessionContent;
    expect(
      buildNewSession('id-2', 'team-1', sessionContent, 'actor-1', NOW),
    ).toEqual({
      id: 'id-2',
      teamId: 'team-1',
      content: sessionContent,
      createdBy: 'actor-1',
      now: NOW,
    });
  });
});

describe('buildSessionStatusChange', () => {
  it('stamps conducted_at only when conducting', () => {
    const conduct = buildSessionStatusChange(
      session(),
      'team-1',
      SessionStatus.Conducted,
      2,
      NOW,
    );
    expect(conduct.conductedAt).toBe(NOW);
    const cancel = buildSessionStatusChange(
      session({ conductedAt: null }),
      'team-1',
      SessionStatus.Cancelled,
      2,
      NOW,
    );
    expect(cancel.conductedAt).toBeNull();
    expect(cancel.toStatus).toBe(SessionStatus.Cancelled);
  });
});

describe('buildNewAttempts', () => {
  it('numbers attempts after the base and converts to canonical units', () => {
    let counter = 0;
    const nextId = (): string => {
      counter += 1;
      return `attempt-${counter}`;
    };
    const attempts = buildNewAttempts(
      'session-1',
      'team-1',
      command([
        attemptInput({ value: 4000, unit: MeasurementUnit.Milliseconds }),
        attemptInput({ value: null }),
      ]),
      protocol(),
      2,
      'coach-1',
      nextId,
      NOW,
    );
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.attemptNumber).toBe(3);
    expect(attempts[0]?.canonicalValue).toBe(4);
    expect(attempts[1]?.attemptNumber).toBe(4);
    expect(attempts[1]?.rawValue).toBeNull();
    expect(attempts[1]?.canonicalValue).toBeNull();
    expect(attempts[0]?.evaluatorUserId).toBe('coach-1');
  });
});

describe('selectProtocolResult + toSelectableAttempts', () => {
  it('derives the best per the protocol direction and policy', () => {
    const attempts = [
      attemptRow({ attemptNumber: 1, canonicalValue: 3.4 }),
      attemptRow({ attemptNumber: 2, canonicalValue: 3.1 }),
    ];
    expect(toSelectableAttempts(attempts)[0]?.value).toBe(3.4);
    const result = selectProtocolResult(protocol(), attempts);
    expect(result.best).toBe(3.1);
    expect(result.selected).toBe(3.1);
  });
});

describe('buildRecordedMeasurement', () => {
  it('assembles the recorded outcome with its derived result', () => {
    const recorded = buildRecordedMeasurement(
      'session-1',
      'member-1',
      protocol(),
      [attemptRow()],
    );
    expect(recorded.sessionId).toBe('session-1');
    expect(recorded.membershipId).toBe('member-1');
    expect(recorded.result.selected).toBe(3.2);
  });
});

describe('buildHistoryEntries', () => {
  it('groups by protocol, keeps order, and skips protocols with no attempts', () => {
    const other = protocol({ id: 'protocol-2', protocolKey: 'vertical_jump' });
    const entries = buildHistoryEntries(
      [protocol(), other],
      [attemptRow({ id: 'a1' }), attemptRow({ id: 'a2', attemptNumber: 2 })],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.protocol.id).toBe('protocol-1');
    expect(entries[0]?.attempts).toHaveLength(2);
  });
});

describe('audit + event builders', () => {
  it('builds protocol, session, and record audit inputs', () => {
    expect(buildProtocolAudit('act', 'actor-1', protocol()).resourceId).toBe(
      'protocol-1',
    );
    expect(buildSessionAudit('act', 'actor-1', session()).resourceId).toBe(
      'session-1',
    );
    const recorded = buildRecordedMeasurement(
      'session-1',
      'member-1',
      protocol(),
      [attemptRow()],
    );
    const audit = buildRecordAudit('act', 'actor-1', recorded, 'team-1');
    expect(audit.teamId).toBe('team-1');
    expect(audit.diff.attemptCount).toBe(1);
  });

  it('builds the MeasurementRecorded event with a privacy-safe payload', () => {
    const recorded = buildRecordedMeasurement(
      'session-1',
      'member-1',
      protocol(),
      [attemptRow()],
    );
    const event = buildMeasurementRecordedEvent('actor-1', 'team-1', recorded);
    expect(event.eventType).toBe('measurement.recorded.v1');
    expect(event.eventVersion).toBe(1);
    expect(event.payload).toMatchObject({
      sessionId: 'session-1',
      membershipId: 'member-1',
      protocolKey: 'sprint_20m',
      attemptCount: 1,
    });
  });
});
