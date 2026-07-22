import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMeeting } from '../lib/governance.mapper';
import { LIST_MAX_LIMIT, MEETING_COLUMNS } from '../model/governance.constants';
import type { GovernanceCountRow, MeetingRow } from '../model/governance.rows';
import type {
  GovernanceMeeting,
  MeetingListFilter,
  MeetingStatusChange,
  NewGovernanceMeeting,
  PageRequest,
} from '../model/governance.types';

/**
 * Persistence for governance meetings. Data access only: parameterized SQL,
 * static column lists, optimistic-version-guarded minute/approval writes, and
 * bounded reads. The decision register is stored as jsonb and validated on read.
 */
@Injectable()
export class MeetingRepository {
  async insert(
    scope: TransactionScope,
    meeting: NewGovernanceMeeting,
  ): Promise<GovernanceMeeting> {
    const rows = await scope.run<MeetingRow>(
      `INSERT INTO "governance_meetings"
        ("id", "team_id", "title", "scheduled_at", "agenda", "visibility",
         "recurrence", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING ${MEETING_COLUMNS}`,
      [
        meeting.id,
        meeting.teamId,
        meeting.title,
        meeting.scheduledAt,
        meeting.agenda,
        meeting.visibility,
        meeting.recurrence,
        meeting.createdBy,
        meeting.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the meeting write');
    }
    return toMeeting(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    meetingId: string,
  ): Promise<GovernanceMeeting | null> {
    const rows = await scope.run<MeetingRow>(
      `SELECT ${MEETING_COLUMNS} FROM "governance_meetings"
        WHERE "id" = $1 AND "team_id" = $2`,
      [meetingId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toMeeting(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: MeetingStatusChange,
  ): Promise<GovernanceMeeting | null> {
    const rows = await scope.run<MeetingRow>(
      `UPDATE "governance_meetings"
          SET "status" = $4, "minutes" = $5, "decisions" = $6::jsonb,
              "minutes_approved_by" = $7, "minutes_approved_at" = $8,
              "updated_at" = $9, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${MEETING_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        change.minutes,
        JSON.stringify(change.decisions),
        change.minutesApprovedBy,
        change.minutesApprovedAt === null
          ? null
          : change.minutesApprovedAt.toISOString(),
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toMeeting(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: MeetingListFilter,
    page: PageRequest,
  ): Promise<readonly GovernanceMeeting[]> {
    const rows = await scope.run<MeetingRow>(
      `SELECT ${MEETING_COLUMNS} FROM "governance_meetings"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "status" = $2)
          AND ($3::text IS NULL OR "visibility" = $3)
        ORDER BY "scheduled_at" DESC, "id" ASC
        LIMIT $4 OFFSET $5`,
      [
        teamId,
        filter.status,
        filter.visibility,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toMeeting(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: MeetingListFilter,
  ): Promise<number> {
    const rows = await scope.run<GovernanceCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "governance_meetings"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "status" = $2)
          AND ($3::text IS NULL OR "visibility" = $3)`,
      [teamId, filter.status, filter.visibility],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
