import type { AuthUserIdentity } from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import {
  buildStatisticsAudit,
  buildStatsProjectedEvent,
} from '../lib/matches.builders';
import { MATCH_STATS_REBUILT_ACTION } from '../model/matches.constants';
import type { Match, MatchStatistics } from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';
import { MatchStatisticsService } from './match-statistics.service';

/**
 * Rebuilds the statistics projection from the event stream and publishes
 * `match.stats_projected`.
 *
 * The rebuild writes NO totals — there are none to write. It runs the same pure
 * derivation the read path runs, which is what makes "rebuilt" and "replayed
 * clean" the same value by construction rather than by convention. The audit
 * entry records which engine and ruleset version produced the figures.
 */
@Injectable()
export class RebuildMatchStatisticsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: MatchLookupService,
    private readonly statistics: MatchStatisticsService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
  ): Promise<MatchStatistics> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, matchId),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
  ): Promise<MatchStatistics> {
    const match = await this.lookup.require(tx, teamId, matchId);
    return this.publish(
      tx,
      actor,
      match,
      await this.statistics.projectFor(tx, match),
    );
  }

  private async publish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    statistics: MatchStatistics,
  ): Promise<MatchStatistics> {
    await this.audit.record(
      tx,
      buildStatisticsAudit(
        MATCH_STATS_REBUILT_ACTION,
        actor.userId,
        statistics,
      ),
    );
    await this.events.enqueue(
      tx,
      buildStatsProjectedEvent(match, statistics, actor.userId),
    );
    return statistics;
  }
}
