import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toDate } from '../lib/practices.helpers';
import {
  parseNullableRsvpStatus,
  parseReasonCategory,
  parseRsvpSource,
  parseRsvpStatus,
} from '../lib/rsvp.helpers';
import { RSVP_REVISION_COLUMNS } from '../model/rsvp.constants';
import type { RsvpRevisionRow } from '../model/rsvp.rows';
import type { NewRsvpRevision, RsvpRevision } from '../model/rsvp.types';

/**
 * Append-only revision history for practice RSVP. Every response change — self,
 * coach override (with reason), or a system waitlist promotion — is recorded as an
 * immutable row in the same transaction as the effective-row write it describes.
 * Reads are bounded and deterministically ordered oldest-first, so intent history
 * survives even after a session is cancelled.
 */
@Injectable()
export class PracticeRsvpRevisionRepository {
  async append(
    scope: TransactionScope,
    revision: NewRsvpRevision,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "practice_rsvp_revisions" ("id", "rsvp_id", "session_id",
              "membership_id", "from_status", "to_status", "reason_category",
              "note", "waitlisted", "source", "is_override", "override_reason",
              "actor_user_id", "occurred_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        revision.id,
        revision.rsvpId,
        revision.sessionId,
        revision.membershipId,
        revision.fromStatus,
        revision.toStatus,
        revision.reasonCategory,
        revision.note,
        revision.waitlisted,
        revision.source,
        revision.isOverride,
        revision.overrideReason,
        revision.actorUserId,
        revision.now.toISOString(),
      ],
    );
  }

  async listBySessionMembership(
    scope: TransactionScope,
    sessionId: string,
    membershipId: string,
    limit: number,
  ): Promise<readonly RsvpRevision[]> {
    const rows = await scope.run<RsvpRevisionRow>(
      `SELECT ${RSVP_REVISION_COLUMNS} FROM "practice_rsvp_revisions"
        WHERE "session_id" = $1 AND "membership_id" = $2
        ORDER BY "occurred_at" ASC, "id" ASC
        LIMIT $3`,
      [sessionId, membershipId, limit],
    );
    return rows.map(row => this.toRevision(row));
  }

  private toRevision(row: RsvpRevisionRow): RsvpRevision {
    return {
      id: row.id,
      rsvpId: row.rsvp_id,
      sessionId: row.session_id,
      membershipId: row.membership_id,
      fromStatus: parseNullableRsvpStatus(row.from_status),
      toStatus: parseRsvpStatus(row.to_status),
      reasonCategory: parseReasonCategory(row.reason_category),
      note: row.note,
      waitlisted: row.waitlisted,
      source: parseRsvpSource(row.source),
      isOverride: row.is_override,
      overrideReason: row.override_reason,
      actorUserId: row.actor_user_id,
      occurredAt: toDate(row.occurred_at),
    };
  }
}
