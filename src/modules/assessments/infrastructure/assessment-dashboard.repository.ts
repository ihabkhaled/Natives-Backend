import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  ASSESSMENT_PUBLISHED_STATE,
  ASSESSMENT_SUBMITTED_STATE,
} from '../model/signals.constants';
import type { AssessmentSignalCountRow } from '../model/signals.rows';

/**
 * Persistence for the assessments dashboard projections. Two parameterized
 * aggregate reads over the current (non-superseded) revisions only, each
 * returning a single row — no row scan reaches the caller and there is no
 * per-assessment follow-up query.
 */
@Injectable()
export class AssessmentDashboardRepository {
  countPublishedForMember(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<AssessmentSignalCountRow[]> {
    return scope.run<AssessmentSignalCountRow>(
      `SELECT COUNT(*)::int AS "count", MAX("a"."published_at") AS "boundary_at"
         FROM "player_assessments" "a"
        WHERE "a"."team_id" = $1 AND "a"."membership_id" = $2
          AND "a"."status" = $3 AND "a"."superseded_at" IS NULL`,
      [teamId, membershipId, ASSESSMENT_PUBLISHED_STATE],
    );
  }

  countAwaitingReview(
    scope: TransactionScope,
    teamId: string,
  ): Promise<AssessmentSignalCountRow[]> {
    return scope.run<AssessmentSignalCountRow>(
      `SELECT COUNT(*)::int AS "count", MIN("a"."submitted_at") AS "boundary_at"
         FROM "player_assessments" "a"
        WHERE "a"."team_id" = $1 AND "a"."status" = $2
          AND "a"."superseded_at" IS NULL`,
      [teamId, ASSESSMENT_SUBMITTED_STATE],
    );
  }
}
