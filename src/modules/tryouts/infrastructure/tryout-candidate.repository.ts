import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toCandidate, toFunnelCounts } from '../lib/tryouts.mapper';
import {
  ANONYMIZED_PLACEHOLDER,
  CANDIDATE_COLUMNS,
  LIST_MAX_LIMIT,
  RETENTION_MAX_BATCH,
} from '../model/tryouts.constants';
import type {
  CandidateRow,
  FunnelCountRow,
  TryoutCountRow,
} from '../model/tryouts.rows';
import type {
  CandidateListFilter,
  CandidateStatusChange,
  NewTryoutCandidate,
  PageRequest,
  TryoutCandidate,
} from '../model/tryouts.types';

/**
 * Persistence for tryout candidates. Data access only: parameterized SQL, static
 * column lists, optimistic-version-guarded lifecycle writes, and bounded reads.
 *
 * The anonymization write is a single UPDATE that overwrites every free-text
 * personal column in place — the row itself survives so funnel statistics stay
 * truthful, but the person is no longer identifiable from it.
 */
@Injectable()
export class TryoutCandidateRepository {
  async insert(
    scope: TransactionScope,
    candidate: NewTryoutCandidate,
  ): Promise<TryoutCandidate> {
    const rows = await scope.run<CandidateRow>(
      `INSERT INTO "tryout_candidates"
        ("id", "team_id", "event_id", "display_name", "identity_hash",
         "contact_channel", "contact_reference", "prior_sport",
         "referral_source", "motivation", "communication_opt_in",
         "consent_version", "consented_at", "readiness", "restricted_notes",
         "status", "waitlist_position", "retention_expires_at", "created_by",
         "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $19, $13,
               $14, $15, $16, $17, $18, $19, $19)
       RETURNING ${CANDIDATE_COLUMNS}`,
      this.insertParameters(candidate),
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the candidate write');
    }
    return toCandidate(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    candidateId: string,
  ): Promise<TryoutCandidate | null> {
    const rows = await scope.run<CandidateRow>(
      `SELECT ${CANDIDATE_COLUMNS} FROM "tryout_candidates"
        WHERE "id" = $1 AND "team_id" = $2`,
      [candidateId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toCandidate(row);
  }

  /** The duplicate probe: same event, same one-way identity fingerprint. */
  async findByIdentityHash(
    scope: TransactionScope,
    eventId: string,
    identityHash: string,
  ): Promise<TryoutCandidate | null> {
    const rows = await scope.run<CandidateRow>(
      `SELECT ${CANDIDATE_COLUMNS} FROM "tryout_candidates"
        WHERE "event_id" = $1 AND "identity_hash" = $2`,
      [eventId, identityHash],
    );
    const row = rows[0];
    return row === undefined ? null : toCandidate(row);
  }

  async countSeated(scope: TransactionScope, eventId: string): Promise<number> {
    const rows = await scope.run<TryoutCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "tryout_candidates"
        WHERE "event_id" = $1
          AND "status" NOT IN ('withdrawn', 'rejected', 'waitlisted')`,
      [eventId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: CandidateStatusChange,
  ): Promise<TryoutCandidate | null> {
    const rows = await scope.run<CandidateRow>(
      `UPDATE "tryout_candidates"
          SET "status" = $4, "checked_in_at" = $5, "withdrawn_at" = $6,
              "updated_at" = $7, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${CANDIDATE_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        this.instant(change.checkedInAt),
        this.instant(change.withdrawnAt),
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toCandidate(row);
  }

  /**
   * Link the membership created by conversion. The guard `converted_at IS NULL`
   * makes conversion idempotent at the database level: a replayed conversion
   * updates nothing and returns null.
   */
  async linkMembership(
    scope: TransactionScope,
    candidateId: string,
    membershipId: string,
    now: Date,
  ): Promise<TryoutCandidate | null> {
    const rows = await scope.run<CandidateRow>(
      `UPDATE "tryout_candidates"
          SET "converted_membership_id" = $2, "converted_at" = $3,
              "status" = 'converted', "updated_at" = $3,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "converted_at" IS NULL
       RETURNING ${CANDIDATE_COLUMNS}`,
      [candidateId, membershipId, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : toCandidate(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: CandidateListFilter,
    page: PageRequest,
  ): Promise<readonly TryoutCandidate[]> {
    const rows = await scope.run<CandidateRow>(
      `SELECT ${CANDIDATE_COLUMNS} FROM "tryout_candidates"
        WHERE ${this.predicate()}
        ORDER BY "created_at" ASC, "id" ASC
        LIMIT $5 OFFSET $6`,
      [
        ...this.filterParameters(teamId, filter),
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toCandidate(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: CandidateListFilter,
  ): Promise<number> {
    const rows = await scope.run<TryoutCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "tryout_candidates"
        WHERE ${this.predicate()}`,
      this.filterParameters(teamId, filter),
    );
    return Number(rows[0]?.count ?? 0);
  }

  /** Per-status counts for the privacy-safe funnel. No identities returned. */
  async countByStatus(
    scope: TransactionScope,
    eventId: string,
  ): Promise<ReadonlyMap<string, number>> {
    const rows = await scope.run<FunnelCountRow>(
      `SELECT "status", COUNT(*)::int AS "count" FROM "tryout_candidates"
        WHERE "event_id" = $1
        GROUP BY "status"
        ORDER BY "status" ASC`,
      [eventId],
    );
    return toFunnelCounts(rows);
  }

  /** Candidates whose retention window has elapsed and are still identifiable. */
  async listExpired(
    scope: TransactionScope,
    teamId: string,
    now: Date,
  ): Promise<readonly TryoutCandidate[]> {
    const rows = await scope.run<CandidateRow>(
      `SELECT ${CANDIDATE_COLUMNS} FROM "tryout_candidates"
        WHERE "team_id" = $1 AND "anonymized_at" IS NULL
          AND "retention_expires_at" <= $2
        ORDER BY "retention_expires_at" ASC, "id" ASC
        LIMIT $3`,
      [teamId, now.toISOString(), RETENTION_MAX_BATCH],
    );
    return rows.map(row => toCandidate(row));
  }

  async anonymize(
    scope: TransactionScope,
    candidateId: string,
    now: Date,
  ): Promise<boolean> {
    const rows = await scope.run<CandidateRow>(
      `UPDATE "tryout_candidates"
          SET "display_name" = $2, "contact_channel" = 'none',
              "contact_reference" = NULL, "prior_sport" = NULL,
              "referral_source" = NULL, "motivation" = NULL,
              "restricted_notes" = NULL, "communication_opt_in" = false,
              "anonymized_at" = $3, "updated_at" = $3,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "anonymized_at" IS NULL
       RETURNING ${CANDIDATE_COLUMNS}`,
      [candidateId, ANONYMIZED_PLACEHOLDER, now.toISOString()],
    );
    return rows.length > 0;
  }

  private predicate(): string {
    return `"team_id" = $1
          AND ($2::uuid IS NULL OR "event_id" = $2)
          AND ($3::text IS NULL OR "status" = $3)
          AND ($4::text IS NULL OR "readiness" = $4)`;
  }

  private filterParameters(
    teamId: string,
    filter: CandidateListFilter,
  ): readonly unknown[] {
    return [teamId, filter.eventId, filter.status, filter.readiness];
  }

  private insertParameters(candidate: NewTryoutCandidate): readonly unknown[] {
    return [
      candidate.id,
      candidate.teamId,
      candidate.eventId,
      candidate.displayName,
      candidate.identityHash,
      candidate.contactChannel,
      candidate.contactReference,
      candidate.priorSport,
      candidate.referralSource,
      candidate.motivation,
      candidate.communicationOptIn,
      candidate.consentVersion,
      candidate.readiness,
      candidate.restrictedNotes,
      candidate.status,
      candidate.waitlistPosition,
      candidate.retentionExpiresAt.toISOString(),
      candidate.createdBy,
      candidate.now.toISOString(),
    ];
  }

  private instant(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
  }
}
