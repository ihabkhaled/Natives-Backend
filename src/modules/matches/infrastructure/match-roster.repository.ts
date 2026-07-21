import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMatchRosterMember } from '../lib/matches.mapper';
import { STATS_ROSTER_MAX } from '../model/matches.constants';
import type { IdRow, MatchRosterMemberRow } from '../model/matches.rows';
import type { MatchRosterMember } from '../model/matches.types';

/**
 * Read-only access to the match roster behind a match. Data access only:
 * parameterized SQL, static columns, bounded and deterministically ordered.
 *
 * This is the source of ZERO-CONTRIBUTION COMPLETENESS: every rostered player —
 * including one a later revision withdrew — is returned so the statistics
 * projection lists them with a measured zero rather than dropping them from the
 * report because the stream never mentioned them.
 */
@Injectable()
export class MatchRosterRepository {
  async listMembers(
    scope: TransactionScope,
    matchId: string,
  ): Promise<readonly MatchRosterMember[]> {
    const rows = await scope.run<MatchRosterMemberRow>(
      `SELECT e."membership_id" AS "membership_id", e."id" AS "roster_entry_id"
         FROM "roster_entries" e
         JOIN "matches" m ON m."roster_id" = e."roster_id"
        WHERE m."id" = $1 AND e."team_id" = m."team_id"
        ORDER BY e."membership_id" ASC
        LIMIT $2`,
      [matchId, STATS_ROSTER_MAX],
    );
    return rows.map(row => toMatchRosterMember(row));
  }

  /** True when the membership is on the match roster, for lineup validation. */
  async isRostered(
    scope: TransactionScope,
    matchId: string,
    membershipId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT e."id" FROM "roster_entries" e
         JOIN "matches" m ON m."roster_id" = e."roster_id"
        WHERE m."id" = $1 AND e."membership_id" = $2
          AND e."team_id" = m."team_id"`,
      [matchId, membershipId],
    );
    return rows.length > 0;
  }

  /** The roster entry a lineup row cites, or null when the match has no roster. */
  async findEntryId(
    scope: TransactionScope,
    matchId: string,
    membershipId: string,
  ): Promise<string | null> {
    const rows = await scope.run<IdRow>(
      `SELECT e."id" FROM "roster_entries" e
         JOIN "matches" m ON m."roster_id" = e."roster_id"
        WHERE m."id" = $1 AND e."membership_id" = $2
          AND e."team_id" = m."team_id"
        LIMIT 1`,
      [matchId, membershipId],
    );
    return rows[0]?.id ?? null;
  }
}
