import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  toDecision,
  toEvaluation,
  toEvaluatorCompletion,
  toOffer,
} from '../lib/tryouts.mapper';
import {
  DECISION_COLUMNS,
  EVALUATION_COLUMNS,
  EVALUATION_UPSERT_SQL,
  LIST_MAX_LIMIT,
  OFFER_COLUMNS,
} from '../model/tryouts.constants';
import type {
  DecisionRow,
  EvaluationRow,
  EvaluatorCompletionRow,
  OfferRow,
  TryoutIdRow,
} from '../model/tryouts.rows';
import type {
  CandidateMembership,
  EvaluationUpsert,
  EvaluatorCompletion,
  NewTryoutDecision,
  NewTryoutOffer,
  OfferStatusChange,
  TryoutDecision,
  TryoutEvaluation,
  TryoutOffer,
} from '../model/tryouts.types';

/**
 * Persistence for the selection side of a tryout: evaluations, decisions,
 * offers, and the membership row a conversion creates. Data access only —
 * parameterized SQL, static column lists, bounded reads.
 *
 * Evaluations are upserted per (candidate, evaluator) so an evaluator revises
 * their OWN original and never overwrites a colleague's. Decisions are
 * append-only (the table carries an ON UPDATE DO INSTEAD NOTHING rule), so a
 * reconsideration is a later row rather than a rewritten verdict.
 */
@Injectable()
export class TryoutSelectionRepository {
  async upsertEvaluation(
    scope: TransactionScope,
    evaluation: EvaluationUpsert,
  ): Promise<TryoutEvaluation> {
    const rows = await scope.run<EvaluationRow>(EVALUATION_UPSERT_SQL, [
      evaluation.id,
      evaluation.teamId,
      evaluation.candidateId,
      evaluation.evaluatorUserId,
      evaluation.criteriaVersion,
      evaluation.attended,
      JSON.stringify(evaluation.ratings),
      evaluation.observations,
      evaluation.privateNotes,
      evaluation.recommendation,
      evaluation.status,
      evaluation.submittedAt === null
        ? null
        : evaluation.submittedAt.toISOString(),
      evaluation.now.toISOString(),
    ]);
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the evaluation write');
    }
    return toEvaluation(row);
  }

  async listEvaluations(
    scope: TransactionScope,
    candidateId: string,
  ): Promise<readonly TryoutEvaluation[]> {
    const rows = await scope.run<EvaluationRow>(
      `SELECT ${EVALUATION_COLUMNS} FROM "tryout_evaluations"
        WHERE "candidate_id" = $1
        ORDER BY "evaluator_user_id" ASC
        LIMIT $2`,
      [candidateId, LIST_MAX_LIMIT],
    );
    return rows.map(row => toEvaluation(row));
  }

  async listEvaluatorCompletion(
    scope: TransactionScope,
    eventId: string,
  ): Promise<readonly EvaluatorCompletion[]> {
    const rows = await scope.run<EvaluatorCompletionRow>(
      `SELECT e."evaluator_user_id" AS "evaluator_user_id",
              COUNT(*)::int AS "assigned",
              COUNT(*) FILTER (WHERE e."status" = 'submitted')::int
                AS "submitted"
         FROM "tryout_evaluations" e
         JOIN "tryout_candidates" c ON c."id" = e."candidate_id"
        WHERE c."event_id" = $1
        GROUP BY e."evaluator_user_id"
        ORDER BY e."evaluator_user_id" ASC
        LIMIT $2`,
      [eventId, LIST_MAX_LIMIT],
    );
    return rows.map(row => toEvaluatorCompletion(row));
  }

  async insertDecision(
    scope: TransactionScope,
    decision: NewTryoutDecision,
  ): Promise<TryoutDecision> {
    const rows = await scope.run<DecisionRow>(
      `INSERT INTO "tryout_decisions"
        ("id", "team_id", "candidate_id", "decision", "reasons",
         "criteria_version", "evaluator_count", "decided_by", "decided_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${DECISION_COLUMNS}`,
      [
        decision.id,
        decision.teamId,
        decision.candidateId,
        decision.decision,
        decision.reasons,
        decision.criteriaVersion,
        decision.evaluatorCount,
        decision.decidedBy,
        decision.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the decision write');
    }
    return toDecision(row);
  }

  async findLatestDecision(
    scope: TransactionScope,
    candidateId: string,
  ): Promise<TryoutDecision | null> {
    const rows = await scope.run<DecisionRow>(
      `SELECT ${DECISION_COLUMNS} FROM "tryout_decisions"
        WHERE "candidate_id" = $1
        ORDER BY "decided_at" DESC, "id" DESC
        LIMIT 1`,
      [candidateId],
    );
    const row = rows[0];
    return row === undefined ? null : toDecision(row);
  }

  async insertOffer(
    scope: TransactionScope,
    offer: NewTryoutOffer,
  ): Promise<TryoutOffer> {
    const rows = await scope.run<OfferRow>(
      `INSERT INTO "tryout_offers"
        ("id", "team_id", "candidate_id", "status", "candidate_message",
         "expires_at", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $7)
       RETURNING ${OFFER_COLUMNS}`,
      [
        offer.id,
        offer.teamId,
        offer.candidateId,
        offer.candidateMessage,
        offer.expiresAt.toISOString(),
        offer.createdBy,
        offer.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the offer write');
    }
    return toOffer(row);
  }

  async findLiveOffer(
    scope: TransactionScope,
    candidateId: string,
  ): Promise<TryoutOffer | null> {
    const rows = await scope.run<OfferRow>(
      `SELECT ${OFFER_COLUMNS} FROM "tryout_offers"
        WHERE "candidate_id" = $1 AND "status" IN ('draft', 'sent')
        LIMIT 1`,
      [candidateId],
    );
    const row = rows[0];
    return row === undefined ? null : toOffer(row);
  }

  async findAcceptedOffer(
    scope: TransactionScope,
    candidateId: string,
  ): Promise<TryoutOffer | null> {
    const rows = await scope.run<OfferRow>(
      `SELECT ${OFFER_COLUMNS} FROM "tryout_offers"
        WHERE "candidate_id" = $1 AND "status" = 'accepted'
        ORDER BY "responded_at" DESC NULLS LAST, "id" DESC
        LIMIT 1`,
      [candidateId],
    );
    const row = rows[0];
    return row === undefined ? null : toOffer(row);
  }

  async applyOfferStatusChange(
    scope: TransactionScope,
    change: OfferStatusChange,
  ): Promise<TryoutOffer | null> {
    const rows = await scope.run<OfferRow>(
      `UPDATE "tryout_offers"
          SET "status" = $4, "sent_at" = $5, "responded_at" = $6,
              "updated_at" = $7, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${OFFER_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        change.sentAt === null ? null : change.sentAt.toISOString(),
        change.respondedAt === null ? null : change.respondedAt.toISOString(),
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toOffer(row);
  }

  /**
   * Resolve an existing membership for the person being converted, so a
   * returning player is re-used rather than duplicated.
   */
  async findExistingMembership(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<string | null> {
    const rows = await scope.run<TryoutIdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "team_id" = $1 AND "user_id" = $2 AND "deleted_at" IS NULL
        ORDER BY "created_at" ASC
        LIMIT 1`,
      [teamId, userId],
    );
    return rows[0]?.id ?? null;
  }

  async insertMembership(
    scope: TransactionScope,
    membership: CandidateMembership,
  ): Promise<string> {
    const rows = await scope.run<TryoutIdRow>(
      `INSERT INTO "memberships"
        ("id", "team_id", "season_id", "user_id", "status",
         "status_effective_at", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, 'invited', $5, $6, $5, $5)
       RETURNING "id"`,
      [
        membership.id,
        membership.teamId,
        membership.seasonId,
        membership.userId,
        membership.now.toISOString(),
        membership.createdBy,
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the membership write');
    }
    return row.id;
  }
}
