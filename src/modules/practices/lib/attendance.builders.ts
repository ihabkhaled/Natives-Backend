import {
  type AuditInput,
  AuditOutcome,
  type DomainEventInput,
} from '@modules/platform';

import {
  ATTENDANCE_AGGREGATE_TYPE,
  ATTENDANCE_BULK_RECORDED_ACTION,
  ATTENDANCE_CHECKED_IN_ACTION,
  ATTENDANCE_CORRECTED_ACTION,
  ATTENDANCE_CORRECTED_EVENT,
  ATTENDANCE_EVENT_VERSION,
  ATTENDANCE_FINALIZED_ACTION,
  ATTENDANCE_FINALIZED_EVENT,
  ATTENDANCE_RECIPIENT_KEY,
  ATTENDANCE_RECORD_RESOURCE_TYPE,
  ATTENDANCE_RECORDED_ACTION,
  ATTENDANCE_SHEET_RESOURCE_TYPE,
} from '../model/attendance.constants';
import { AttendanceSource } from '../model/attendance.enums';
import type {
  AttendanceMarkInput,
  AttendanceRecord,
  AttendanceRecordUpdate,
  AttendanceSheet,
  AttendanceWriteContext,
  CorrectAttendanceCommand,
  MembershipRef,
  NewAttendanceRecord,
  NewAttendanceRevision,
  NewAttendanceSheet,
  SelfCheckInDerivation,
  SheetCorrection,
  SheetFinalize,
} from '../model/attendance.types';
import type { PracticeSession } from '../model/practices.types';

/**
 * Pure builders that turn an attendance write context (or a resulting row) into the
 * persistence, audit, and outbox-event payloads. Kept free of injected ports so
 * they stay trivially unit-testable and reusable by every write path. Audit diffs
 * and event payloads carry only non-sensitive scalars — never the free-text note,
 * evidence reference, or excuse category — so redaction and privacy are total by
 * construction.
 */

/** Build the insert row for a session's OPEN attendance sheet. */
export function buildNewSheet(
  id: string,
  session: PracticeSession,
  actorUserId: string | null,
  now: Date,
): NewAttendanceSheet {
  return {
    id,
    sessionId: session.id,
    teamId: session.teamId,
    seasonId: session.seasonId,
    createdBy: actorUserId,
    now,
  };
}

/** Build the insert row for a first-time attendance mark. */
export function buildNewRecord(
  id: string,
  ctx: AttendanceWriteContext,
): NewAttendanceRecord {
  return {
    id,
    sheetId: ctx.sheetId,
    sessionId: ctx.session.id,
    teamId: ctx.session.teamId,
    seasonId: ctx.session.seasonId,
    membershipId: ctx.membershipId,
    userId: ctx.userId,
    status: ctx.status,
    checkInAt: ctx.checkInAt,
    checkOutAt: ctx.checkOutAt,
    latenessMinutes: ctx.latenessMinutes,
    excuseCategory: ctx.excuseCategory,
    note: ctx.note,
    evidenceRef: ctx.evidenceRef,
    source: ctx.source,
    recordedBy: ctx.actorUserId,
    recordedAt: ctx.now,
    createdBy: ctx.actorUserId,
    now: ctx.now,
  };
}

/** Build a version-guarded update for an existing attendance record. */
export function buildRecordUpdate(
  existing: AttendanceRecord,
  ctx: AttendanceWriteContext,
): AttendanceRecordUpdate {
  return {
    id: existing.id,
    status: ctx.status,
    checkInAt: ctx.checkInAt,
    checkOutAt: ctx.checkOutAt,
    latenessMinutes: ctx.latenessMinutes,
    excuseCategory: ctx.excuseCategory,
    note: ctx.note,
    evidenceRef: ctx.evidenceRef,
    source: ctx.source,
    recordedBy: ctx.actorUserId,
    recordedAt: ctx.now,
    updatedBy: ctx.actorUserId,
    expectedVersion: existing.version,
    now: ctx.now,
  };
}

/** Build the append-only revision row for a recorded/corrected mark. */
export function buildAttendanceRevision(
  id: string,
  previous: AttendanceRecord | null,
  record: AttendanceRecord,
  ctx: AttendanceWriteContext,
): NewAttendanceRevision {
  return {
    id,
    recordId: record.id,
    sessionId: record.sessionId,
    membershipId: record.membershipId,
    fromStatus: previous === null ? null : previous.status,
    toStatus: record.status,
    latenessMinutes: record.latenessMinutes,
    excuseCategory: record.excuseCategory,
    source: ctx.source,
    isCorrection: ctx.isCorrection,
    correctionReason: ctx.correctionReason,
    actorUserId: ctx.actorUserId,
    now: ctx.now,
  };
}

/** Build the write context for a coach mark of one participant. */
export function buildMarkContext(
  sheetId: string,
  session: PracticeSession,
  membership: MembershipRef,
  mark: AttendanceMarkInput,
  actorUserId: string | null,
  now: Date,
): AttendanceWriteContext {
  return {
    sheetId,
    session,
    membershipId: membership.id,
    userId: membership.userId,
    status: mark.status,
    checkInAt: mark.checkInAt,
    checkOutAt: mark.checkOutAt,
    latenessMinutes: mark.latenessMinutes,
    excuseCategory: mark.excuseCategory,
    note: mark.note,
    evidenceRef: mark.evidenceRef,
    source: AttendanceSource.Coach,
    isCorrection: false,
    correctionReason: null,
    expectedVersion: mark.expectedVersion,
    actorUserId,
    now,
  };
}

/** Build the write context for a member's self check-in (status derived). */
export function buildCheckInContext(
  sheetId: string,
  session: PracticeSession,
  membership: MembershipRef,
  derivation: SelfCheckInDerivation,
  note: string | null,
  actorUserId: string | null,
  now: Date,
): AttendanceWriteContext {
  return {
    sheetId,
    session,
    membershipId: membership.id,
    userId: membership.userId,
    status: derivation.status,
    checkInAt: now,
    checkOutAt: null,
    latenessMinutes: derivation.latenessMinutes,
    excuseCategory: null,
    note,
    evidenceRef: null,
    source: AttendanceSource.Self,
    isCorrection: false,
    correctionReason: null,
    expectedVersion: null,
    actorUserId,
    now,
  };
}

/** Build the write context for a privileged correction of one participant. */
export function buildCorrectionContext(
  sheetId: string,
  session: PracticeSession,
  membership: MembershipRef,
  command: CorrectAttendanceCommand,
  actorUserId: string | null,
  now: Date,
): AttendanceWriteContext {
  return {
    sheetId,
    session,
    membershipId: membership.id,
    userId: membership.userId,
    status: command.status,
    checkInAt: command.checkInAt,
    checkOutAt: command.checkOutAt,
    latenessMinutes: command.latenessMinutes,
    excuseCategory: command.excuseCategory,
    note: command.note,
    evidenceRef: command.evidenceRef,
    source: AttendanceSource.Coach,
    isCorrection: true,
    correctionReason: command.correctionReason,
    expectedVersion: command.expectedVersion,
    actorUserId,
    now,
  };
}

/** Build the version-guarded finalize write for a sheet. */
export function buildSheetFinalize(
  sheetId: string,
  expectedVersion: number,
  actorUserId: string | null,
  now: Date,
): SheetFinalize {
  return { id: sheetId, finalizedBy: actorUserId, expectedVersion, now };
}

/** Build the correction write that moves a sheet into the CORRECTED state. */
export function buildSheetCorrection(
  sheetId: string,
  actorUserId: string | null,
  now: Date,
): SheetCorrection {
  return { id: sheetId, updatedBy: actorUserId, now };
}

function recordAction(ctx: AttendanceWriteContext): string {
  if (ctx.isCorrection) {
    return ATTENDANCE_CORRECTED_ACTION;
  }
  return ctx.source === AttendanceSource.Self
    ? ATTENDANCE_CHECKED_IN_ACTION
    : ATTENDANCE_RECORDED_ACTION;
}

/** Build the audit entry for one recorded/corrected attendance mark. */
export function buildRecordAudit(
  ctx: AttendanceWriteContext,
  record: AttendanceRecord,
): AuditInput {
  return {
    actorUserId: ctx.actorUserId,
    action: recordAction(ctx),
    resourceType: ATTENDANCE_RECORD_RESOURCE_TYPE,
    resourceId: record.id,
    teamId: record.teamId,
    seasonId: record.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: record.status,
      source: record.source,
      latenessMinutes: record.latenessMinutes,
      isCorrection: ctx.isCorrection,
    },
  };
}

/** Build the audit entry for a bulk record run (a summary alongside per-row audit). */
export function buildBulkAudit(
  actorUserId: string | null,
  sheet: AttendanceSheet,
  count: number,
): AuditInput {
  return {
    actorUserId,
    action: ATTENDANCE_BULK_RECORDED_ACTION,
    resourceType: ATTENDANCE_SHEET_RESOURCE_TYPE,
    resourceId: sheet.id,
    teamId: sheet.teamId,
    seasonId: sheet.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: { count },
  };
}

/** Build the audit entry for a sheet finalization. */
export function buildFinalizeAudit(
  actorUserId: string | null,
  sheet: AttendanceSheet,
): AuditInput {
  return {
    actorUserId,
    action: ATTENDANCE_FINALIZED_ACTION,
    resourceType: ATTENDANCE_SHEET_RESOURCE_TYPE,
    resourceId: sheet.id,
    teamId: sheet.teamId,
    seasonId: sheet.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: { state: sheet.state },
  };
}

/** Build the outbox event announcing a finalized attendance sheet. */
export function buildFinalizedEvent(
  actorUserId: string | null,
  sheet: AttendanceSheet,
  recordCount: number,
): DomainEventInput {
  return {
    aggregateType: ATTENDANCE_AGGREGATE_TYPE,
    aggregateId: sheet.id,
    eventType: ATTENDANCE_FINALIZED_EVENT,
    eventVersion: ATTENDANCE_EVENT_VERSION,
    actorUserId,
    teamId: sheet.teamId,
    seasonId: sheet.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      sessionId: sheet.sessionId,
      state: sheet.state,
      recordCount,
    },
  };
}

/** Build the outbox event announcing a corrected attendance record. */
export function buildCorrectedEvent(
  actorUserId: string | null,
  sheet: AttendanceSheet,
  record: AttendanceRecord,
): DomainEventInput {
  return {
    aggregateType: ATTENDANCE_AGGREGATE_TYPE,
    aggregateId: sheet.id,
    eventType: ATTENDANCE_CORRECTED_EVENT,
    eventVersion: ATTENDANCE_EVENT_VERSION,
    actorUserId,
    teamId: sheet.teamId,
    seasonId: sheet.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      sessionId: sheet.sessionId,
      membershipId: record.membershipId,
      status: record.status,
      [ATTENDANCE_RECIPIENT_KEY]: record.userId,
    },
  };
}
