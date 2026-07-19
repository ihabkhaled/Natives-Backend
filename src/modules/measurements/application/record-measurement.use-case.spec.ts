import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeasurementInvalidTransitionError } from '../errors/measurement-invalid-transition.error';
import { MeasurementProtocolNotFoundError } from '../errors/measurement-protocol-not-found.error';
import { MeasurementSessionNotFoundError } from '../errors/measurement-session-not-found.error';
import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ProtocolStatus,
  ResultPolicy,
  SessionStatus,
} from '../model/measurements.enums';
import type {
  MeasurementAttempt,
  MeasurementProtocol,
  MeasurementSession,
  RecordMeasurementCommand,
} from '../model/measurements.types';
import { RecordMeasurementUseCase } from './record-measurement.use-case';

const NOW = new Date('2026-06-01T09:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function protocol(): MeasurementProtocol {
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
  };
}

function session(status = SessionStatus.Scheduled): MeasurementSession {
  return {
    id: 'session-1',
    teamId: 'team-1',
    seasonId: null,
    title: 'Combine',
    status,
    scheduledAt: NOW,
    conductedAt: null,
    location: null,
    conditions: null,
    notes: null,
    recordVersion: 1,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function attempt(): MeasurementAttempt {
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
  };
}

function command(): RecordMeasurementCommand {
  return {
    membershipId: 'member-1',
    protocolId: 'protocol-1',
    attempts: [
      {
        value: 3.2,
        unit: MeasurementUnit.Seconds,
        valid: true,
        disqualified: false,
        dqReason: null,
        notes: null,
      },
    ],
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const idGenerator = { generate: vi.fn(() => 'attempt-1') };
  const scope = { validate: vi.fn(), requireMembership: vi.fn() };
  const sessions = { findForWrite: vi.fn(() => session()) };
  const protocols = { findVisible: vi.fn(() => protocol()) };
  const attempts = {
    nextAttemptBase: vi.fn(() => 0),
    insertMany: vi.fn(),
    listForTarget: vi.fn(() => [attempt()]),
  };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  return {
    scope,
    sessions,
    protocols,
    attempts,
    audit,
    events,
    useCase: new RecordMeasurementUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      scope as never,
      sessions as never,
      protocols as never,
      attempts as never,
      audit as never,
      events as never,
    ),
  };
}

describe('RecordMeasurementUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('records attempts, audits, and emits MeasurementRecorded', async () => {
    const recorded = await harness.useCase.execute(
      actor,
      'team-1',
      'session-1',
      command(),
    );
    expect(harness.scope.requireMembership).toHaveBeenCalled();
    expect(harness.attempts.insertMany).toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalled();
    expect(harness.events.enqueue.mock.calls[0]?.[1].eventType).toBe(
      'measurement.recorded.v1',
    );
    expect(recorded.result.selected).toBe(3.2);
  });

  it('404s when the session does not exist', async () => {
    harness.sessions.findForWrite.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(actor, 'team-1', 'session-1', command()),
    ).rejects.toBeInstanceOf(MeasurementSessionNotFoundError);
    expect(harness.attempts.insertMany).not.toHaveBeenCalled();
  });

  it('rejects recording into a cancelled session', async () => {
    harness.sessions.findForWrite.mockResolvedValueOnce(
      session(SessionStatus.Cancelled),
    );
    await expect(
      harness.useCase.execute(actor, 'team-1', 'session-1', command()),
    ).rejects.toBeInstanceOf(MeasurementInvalidTransitionError);
  });

  it('404s when the protocol is not visible', async () => {
    harness.protocols.findVisible.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(actor, 'team-1', 'session-1', command()),
    ).rejects.toBeInstanceOf(MeasurementProtocolNotFoundError);
  });
});
