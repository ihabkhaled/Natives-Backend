import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMeasurementAttempt } from '../lib/measurements.mapper';
import {
  HISTORY_SCAN_MAX,
  MEASUREMENT_ATTEMPT_COLUMNS,
} from '../model/measurements.constants';
import type {
  CountRow,
  MeasurementAttemptRow,
} from '../model/measurements.rows';
import type {
  MeasurementAttempt,
  NewAttempt,
} from '../model/measurements.types';

/**
 * Persistence for immutable measurement attempts. Data access only: a single
 * set-based insert (never a per-row loop), parameterized SQL, static columns, and
 * bounded/ordered reads. Raw and canonical values are stored together — both NULL
 * for a missing attempt — so a measured zero is never confused with no attempt.
 */
@Injectable()
export class MeasurementAttemptRepository {
  async insertMany(
    scope: TransactionScope,
    attempts: readonly NewAttempt[],
  ): Promise<void> {
    if (attempts.length === 0) {
      return;
    }
    await scope.run(
      `INSERT INTO "measurement_attempts"
        ("id", "session_id", "team_id", "membership_id", "protocol_id",
         "attempt_number", "raw_value", "unit", "canonical_value", "valid",
         "disqualified", "dq_reason", "evaluator_user_id", "notes",
         "recorded_at", "created_at")
       SELECT input."id", input."session_id", input."team_id",
              input."membership_id", input."protocol_id", input."attempt_number",
              input."raw_value", input."unit", input."canonical_value",
              input."valid", input."disqualified", input."dq_reason",
              input."evaluator_user_id", input."notes", input."recorded_at",
              input."recorded_at"
         FROM jsonb_to_recordset($1::jsonb) AS input(
           "id" uuid, "session_id" uuid, "team_id" uuid, "membership_id" uuid,
           "protocol_id" uuid, "attempt_number" integer, "raw_value" numeric,
           "unit" text, "canonical_value" numeric, "valid" boolean,
           "disqualified" boolean, "dq_reason" text, "evaluator_user_id" uuid,
           "notes" text, "recorded_at" timestamptz)`,
      [JSON.stringify(attempts.map(attempt => this.attemptRecord(attempt)))],
    );
  }

  async nextAttemptBase(
    scope: TransactionScope,
    sessionId: string,
    membershipId: string,
    protocolId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COALESCE(MAX("attempt_number"), 0)::int AS "count"
         FROM "measurement_attempts"
        WHERE "session_id" = $1 AND "membership_id" = $2
          AND "protocol_id" = $3`,
      [sessionId, membershipId, protocolId],
    );
    return rows[0]?.count ?? 0;
  }

  async listForSession(
    scope: TransactionScope,
    sessionId: string,
  ): Promise<readonly MeasurementAttempt[]> {
    const rows = await scope.run<MeasurementAttemptRow>(
      `SELECT ${MEASUREMENT_ATTEMPT_COLUMNS} FROM "measurement_attempts"
        WHERE "session_id" = $1
        ORDER BY "membership_id" ASC, "protocol_id" ASC, "attempt_number" ASC
        LIMIT ${HISTORY_SCAN_MAX}`,
      [sessionId],
    );
    return rows.map(row => toMeasurementAttempt(row));
  }

  async listForMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<readonly MeasurementAttempt[]> {
    const rows = await scope.run<MeasurementAttemptRow>(
      `SELECT ${MEASUREMENT_ATTEMPT_COLUMNS} FROM "measurement_attempts"
        WHERE "team_id" = $1 AND "membership_id" = $2
        ORDER BY "protocol_id" ASC, "attempt_number" ASC
        LIMIT ${HISTORY_SCAN_MAX}`,
      [teamId, membershipId],
    );
    return rows.map(row => toMeasurementAttempt(row));
  }

  async listForTarget(
    scope: TransactionScope,
    sessionId: string,
    membershipId: string,
    protocolId: string,
  ): Promise<readonly MeasurementAttempt[]> {
    const rows = await scope.run<MeasurementAttemptRow>(
      `SELECT ${MEASUREMENT_ATTEMPT_COLUMNS} FROM "measurement_attempts"
        WHERE "session_id" = $1 AND "membership_id" = $2 AND "protocol_id" = $3
        ORDER BY "attempt_number" ASC
        LIMIT ${HISTORY_SCAN_MAX}`,
      [sessionId, membershipId, protocolId],
    );
    return rows.map(row => toMeasurementAttempt(row));
  }

  private attemptRecord(
    attempt: NewAttempt,
  ): Readonly<Record<string, unknown>> {
    return {
      id: attempt.id,
      session_id: attempt.sessionId,
      team_id: attempt.teamId,
      membership_id: attempt.membershipId,
      protocol_id: attempt.protocolId,
      attempt_number: attempt.attemptNumber,
      raw_value: attempt.rawValue,
      unit: attempt.unit,
      canonical_value: attempt.canonicalValue,
      valid: attempt.valid,
      disqualified: attempt.disqualified,
      dq_reason: attempt.dqReason,
      evaluator_user_id: attempt.evaluatorUserId,
      notes: attempt.notes,
      recorded_at: attempt.now.toISOString(),
    };
  }
}
