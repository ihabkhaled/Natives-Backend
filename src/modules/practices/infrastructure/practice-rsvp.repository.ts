import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toDate } from '../lib/practices.helpers';
import {
  parseNoteVisibility,
  parseReasonCategory,
  parseRsvpSource,
  parseRsvpStatus,
} from '../lib/rsvp.helpers';
import { RSVP_COLUMNS } from '../model/rsvp.constants';
import type {
  RsvpCountsRow,
  RsvpParticipantRow,
  RsvpRow,
  RsvpTotalRow,
} from '../model/rsvp.rows';
import type {
  ListRsvpsResult,
  NewRsvp,
  PracticeRsvp,
  RsvpCounts,
  RsvpListFilter,
  RsvpParticipant,
  RsvpPromotion,
  RsvpUpdate,
} from '../model/rsvp.types';

/**
 * Persistence for the effective practice-RSVP aggregate. Session-scoped,
 * parameterized, bounded, deterministically ordered, static column lists. Writes
 * are optimistic-version guarded; the first insert uses `ON CONFLICT DO NOTHING`
 * against the (session, membership) unique index so a concurrent duplicate is a
 * clean null the application maps to a version conflict. Summary counts and the
 * participant list are projections from these rows — never stored totals.
 */
@Injectable()
export class PracticeRsvpRepository {
  async findBySessionMembership(
    scope: TransactionScope,
    sessionId: string,
    membershipId: string,
  ): Promise<PracticeRsvp | null> {
    const rows = await scope.run<RsvpRow>(
      `SELECT ${RSVP_COLUMNS} FROM "practice_rsvps"
        WHERE "session_id" = $1 AND "membership_id" = $2`,
      [sessionId, membershipId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRsvp(row);
  }

  async insert(
    scope: TransactionScope,
    rsvp: NewRsvp,
  ): Promise<PracticeRsvp | null> {
    const rows = await scope.run<RsvpRow>(
      `INSERT INTO "practice_rsvps" ("id", "session_id", "team_id", "season_id",
              "membership_id", "user_id", "status", "reason_category", "note",
              "note_visibility", "source", "waitlisted", "responded_at",
              "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $15)
       ON CONFLICT ("session_id", "membership_id") DO NOTHING
       RETURNING ${RSVP_COLUMNS}`,
      [
        rsvp.id,
        rsvp.sessionId,
        rsvp.teamId,
        rsvp.seasonId,
        rsvp.membershipId,
        rsvp.userId,
        rsvp.status,
        rsvp.reasonCategory,
        rsvp.note,
        rsvp.noteVisibility,
        rsvp.source,
        rsvp.waitlisted,
        rsvp.respondedAt.toISOString(),
        rsvp.createdBy,
        rsvp.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRsvp(row);
  }

  async update(
    scope: TransactionScope,
    update: RsvpUpdate,
  ): Promise<PracticeRsvp | null> {
    const rows = await scope.run<RsvpRow>(
      `UPDATE "practice_rsvps"
          SET "status" = $2, "reason_category" = $3, "note" = $4,
              "note_visibility" = $5, "source" = $6, "waitlisted" = $7,
              "responded_at" = $8, "updated_by" = $9, "updated_at" = $10,
              "version" = "version" + 1
        WHERE "id" = $1 AND "version" = $11
       RETURNING ${RSVP_COLUMNS}`,
      [
        update.id,
        update.status,
        update.reasonCategory,
        update.note,
        update.noteVisibility,
        update.source,
        update.waitlisted,
        update.respondedAt.toISOString(),
        update.updatedBy,
        update.now.toISOString(),
        update.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRsvp(row);
  }

  async promote(
    scope: TransactionScope,
    promotion: RsvpPromotion,
  ): Promise<PracticeRsvp | null> {
    const rows = await scope.run<RsvpRow>(
      `UPDATE "practice_rsvps"
          SET "waitlisted" = false, "updated_by" = $2, "updated_at" = $3,
              "version" = "version" + 1
        WHERE "id" = $1 AND "version" = $4 AND "waitlisted" = true
          AND "status" = 'going'
       RETURNING ${RSVP_COLUMNS}`,
      [
        promotion.id,
        promotion.updatedBy,
        promotion.now.toISOString(),
        promotion.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRsvp(row);
  }

  async countConfirmedGoing(
    scope: TransactionScope,
    sessionId: string,
    excludeMembershipId: string,
  ): Promise<number> {
    const rows = await scope.run<RsvpTotalRow>(
      `SELECT COUNT(*)::int AS "count" FROM "practice_rsvps"
        WHERE "session_id" = $1 AND "status" = 'going' AND "waitlisted" = false
          AND "membership_id" <> $2`,
      [sessionId, excludeMembershipId],
    );
    return rows[0]?.count ?? 0;
  }

  async findEarliestWaitlisted(
    scope: TransactionScope,
    sessionId: string,
  ): Promise<PracticeRsvp | null> {
    const rows = await scope.run<RsvpRow>(
      `SELECT ${RSVP_COLUMNS} FROM "practice_rsvps"
        WHERE "session_id" = $1 AND "status" = 'going' AND "waitlisted" = true
        ORDER BY "responded_at" ASC, "id" ASC
        LIMIT 1`,
      [sessionId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRsvp(row);
  }

  async summary(
    scope: TransactionScope,
    sessionId: string,
  ): Promise<RsvpCounts> {
    const rows = await scope.run<RsvpCountsRow>(
      `SELECT
          COUNT(*) FILTER (WHERE "status" = 'going'
            AND "waitlisted" = false)::int AS "going",
          COUNT(*) FILTER (WHERE "status" = 'going'
            AND "waitlisted" = true)::int AS "waitlisted",
          COUNT(*) FILTER (WHERE "status" = 'not_going')::int AS "not_going",
          COUNT(*) FILTER (WHERE "status" = 'maybe')::int AS "maybe",
          COUNT(*) FILTER (WHERE "status" = 'no_response')::int AS "no_response"
         FROM "practice_rsvps"
        WHERE "session_id" = $1`,
      [sessionId],
    );
    return this.toCounts(rows[0]);
  }

  async listParticipants(
    scope: TransactionScope,
    sessionId: string,
    filter: RsvpListFilter,
  ): Promise<ListRsvpsResult> {
    const params: unknown[] = [sessionId];
    const statusClause = this.statusClause(filter, params);
    const rows = await scope.run<RsvpParticipantRow>(
      `SELECT "membership_id", "status", "waitlisted", "source", "responded_at"
         FROM "practice_rsvps"
        WHERE "session_id" = $1${statusClause}
        ORDER BY "responded_at" ASC, "membership_id" ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.limit, filter.offset],
    );
    const counts = await scope.run<RsvpTotalRow>(
      `SELECT COUNT(*)::int AS "count" FROM "practice_rsvps"
        WHERE "session_id" = $1${statusClause}`,
      params,
    );
    return {
      items: rows.map(row => this.toParticipant(row)),
      total: counts[0]?.count ?? 0,
      limit: filter.limit,
      offset: filter.offset,
    };
  }

  private statusClause(filter: RsvpListFilter, params: unknown[]): string {
    if (filter.status === null) {
      return '';
    }
    params.push(filter.status);
    return ` AND "status" = $${params.length}`;
  }

  private toCounts(row: RsvpCountsRow | undefined): RsvpCounts {
    return {
      going: row?.going ?? 0,
      waitlisted: row?.waitlisted ?? 0,
      notGoing: row?.not_going ?? 0,
      maybe: row?.maybe ?? 0,
      noResponse: row?.no_response ?? 0,
    };
  }

  private toParticipant(row: RsvpParticipantRow): RsvpParticipant {
    return {
      membershipId: row.membership_id,
      status: parseRsvpStatus(row.status),
      waitlisted: row.waitlisted,
      source: parseRsvpSource(row.source),
      respondedAt: toDate(row.responded_at),
    };
  }

  private toRsvp(row: RsvpRow): PracticeRsvp {
    return {
      id: row.id,
      sessionId: row.session_id,
      teamId: row.team_id,
      seasonId: row.season_id,
      membershipId: row.membership_id,
      userId: row.user_id,
      status: parseRsvpStatus(row.status),
      reasonCategory: parseReasonCategory(row.reason_category),
      note: row.note,
      noteVisibility: parseNoteVisibility(row.note_visibility),
      source: parseRsvpSource(row.source),
      waitlisted: row.waitlisted,
      respondedAt: toDate(row.responded_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
