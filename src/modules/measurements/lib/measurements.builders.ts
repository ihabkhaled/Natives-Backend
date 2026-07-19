import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import { selectResult } from '../domain/result-selection.policy';
import { convertValue } from '../domain/unit-conversion.policy';
import {
  MEASUREMENT_AGGREGATE,
  MEASUREMENT_EVENT_VERSION,
  MEASUREMENT_RECORDED_EVENT,
  PROTOCOL_RESOURCE_TYPE,
  SESSION_RESOURCE_TYPE,
} from '../model/measurements.constants';
import { SessionStatus } from '../model/measurements.enums';
import type {
  AttemptInput,
  MeasurementAttempt,
  MeasurementProtocol,
  MeasurementSession,
  NewAttempt,
  NewProtocol,
  NewSession,
  ProtocolContent,
  ProtocolHistoryEntry,
  RecordedMeasurement,
  RecordMeasurementCommand,
  ResultSelection,
  SelectableAttempt,
  SessionContent,
  SessionStatusChange,
} from '../model/measurements.types';

/** Build an ACTIVE protocol row from a create command. */
export function buildNewProtocol(
  id: string,
  teamId: string,
  content: ProtocolContent,
  actorUserId: string,
  now: Date,
): NewProtocol {
  return { id, teamId, content, createdBy: actorUserId, now };
}

/** Build a SCHEDULED session row from a create command. */
export function buildNewSession(
  id: string,
  teamId: string,
  content: SessionContent,
  actorUserId: string,
  now: Date,
): NewSession {
  return { id, teamId, content, createdBy: actorUserId, now };
}

/** Build the optimistic-version-guarded session status change for a transition. */
export function buildSessionStatusChange(
  session: MeasurementSession,
  teamId: string,
  toStatus: SessionStatus,
  expectedRecordVersion: number,
  now: Date,
): SessionStatusChange {
  return {
    id: session.id,
    teamId,
    expectedRecordVersion,
    toStatus,
    conductedAt:
      toStatus === SessionStatus.Conducted ? now : session.conductedAt,
    now,
  };
}

/**
 * Build the immutable attempt rows for one player+protocol. Each raw value is
 * converted to the protocol's canonical unit (a null stays null — a missing
 * attempt is never zero); attempt numbers continue after the already-recorded
 * ones so a re-submission appends rather than overwrites.
 */
export function buildNewAttempts(
  sessionId: string,
  teamId: string,
  command: RecordMeasurementCommand,
  protocol: MeasurementProtocol,
  baseAttemptNumber: number,
  evaluatorUserId: string,
  generateId: () => string,
  now: Date,
): readonly NewAttempt[] {
  return command.attempts.map((attempt, index) =>
    buildNewAttempt(
      generateId(),
      sessionId,
      teamId,
      command,
      protocol,
      baseAttemptNumber + index + 1,
      attempt,
      evaluatorUserId,
      now,
    ),
  );
}

function buildNewAttempt(
  id: string,
  sessionId: string,
  teamId: string,
  command: RecordMeasurementCommand,
  protocol: MeasurementProtocol,
  attemptNumber: number,
  attempt: AttemptInput,
  evaluatorUserId: string,
  now: Date,
): NewAttempt {
  return {
    id,
    sessionId,
    teamId,
    membershipId: command.membershipId,
    protocolId: protocol.id,
    attemptNumber,
    rawValue: attempt.value,
    unit: attempt.unit,
    canonicalValue: convertValue(attempt.value, attempt.unit, protocol.unit),
    valid: attempt.valid,
    disqualified: attempt.disqualified,
    dqReason: attempt.dqReason,
    evaluatorUserId,
    notes: attempt.notes,
    now,
  };
}

/** Reduce persisted attempts to the minimal shape the selection policy reads. */
export function toSelectableAttempts(
  attempts: readonly MeasurementAttempt[],
): readonly SelectableAttempt[] {
  return attempts.map(attempt => ({
    attemptNumber: attempt.attemptNumber,
    value: attempt.canonicalValue,
    valid: attempt.valid,
    disqualified: attempt.disqualified,
  }));
}

/** Derive the reported result for a protocol from its persisted attempts. */
export function selectProtocolResult(
  protocol: MeasurementProtocol,
  attempts: readonly MeasurementAttempt[],
): ResultSelection {
  return selectResult(
    toSelectableAttempts(attempts),
    protocol.direction,
    protocol.resultPolicy,
  );
}

/** Assemble the recorded-measurement outcome returned to the recorder. */
export function buildRecordedMeasurement(
  sessionId: string,
  membershipId: string,
  protocol: MeasurementProtocol,
  attempts: readonly MeasurementAttempt[],
): RecordedMeasurement {
  return {
    sessionId,
    membershipId,
    protocol,
    attempts,
    result: selectProtocolResult(protocol, attempts),
  };
}

/**
 * Group a membership's attempts by protocol into history entries, each with its
 * derived result. Only protocols the member actually has attempts for appear, and
 * entries follow the protocol order the caller supplied (deterministic).
 */
export function buildHistoryEntries(
  protocols: readonly MeasurementProtocol[],
  attempts: readonly MeasurementAttempt[],
): readonly ProtocolHistoryEntry[] {
  const byProtocol = groupAttemptsByProtocol(attempts);
  const entries: ProtocolHistoryEntry[] = [];
  for (const protocol of protocols) {
    const owned = byProtocol.get(protocol.id);
    if (owned === undefined) {
      continue;
    }
    entries.push({
      protocol,
      attempts: owned,
      result: selectProtocolResult(protocol, owned),
    });
  }
  return entries;
}

function groupAttemptsByProtocol(
  attempts: readonly MeasurementAttempt[],
): ReadonlyMap<string, MeasurementAttempt[]> {
  const map = new Map<string, MeasurementAttempt[]>();
  for (const attempt of attempts) {
    const bucket = map.get(attempt.protocolId) ?? [];
    bucket.push(attempt);
    map.set(attempt.protocolId, bucket);
  }
  return map;
}

export function buildProtocolAudit(
  action: string,
  actorUserId: string,
  protocol: MeasurementProtocol,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: PROTOCOL_RESOURCE_TYPE,
    resourceId: protocol.id,
    teamId: protocol.teamId,
    seasonId: protocol.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      protocolKey: protocol.protocolKey,
      discipline: protocol.discipline,
      unit: protocol.unit,
      status: protocol.status,
    },
  };
}

export function buildSessionAudit(
  action: string,
  actorUserId: string,
  session: MeasurementSession,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: SESSION_RESOURCE_TYPE,
    resourceId: session.id,
    teamId: session.teamId,
    seasonId: session.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: session.status,
      recordVersion: session.recordVersion,
    },
  };
}

export function buildRecordAudit(
  action: string,
  actorUserId: string,
  recorded: RecordedMeasurement,
  teamId: string,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: MEASUREMENT_AGGREGATE,
    resourceId: recorded.sessionId,
    teamId,
    seasonId: recorded.protocol.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      membershipId: recorded.membershipId,
      protocolId: recorded.protocol.id,
      protocolKey: recorded.protocol.protocolKey,
      attemptCount: recorded.attempts.length,
    },
  };
}

export function buildMeasurementRecordedEvent(
  actorUserId: string,
  teamId: string,
  recorded: RecordedMeasurement,
): DomainEventInput {
  return {
    aggregateType: MEASUREMENT_AGGREGATE,
    aggregateId: recorded.sessionId,
    eventType: MEASUREMENT_RECORDED_EVENT,
    eventVersion: MEASUREMENT_EVENT_VERSION,
    actorUserId,
    teamId,
    seasonId: recorded.protocol.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      sessionId: recorded.sessionId,
      membershipId: recorded.membershipId,
      protocolId: recorded.protocol.id,
      protocolKey: recorded.protocol.protocolKey,
      attemptCount: recorded.attempts.length,
      method: recorded.result.method,
    },
  };
}
