import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { MatchEventsController } from './api/match-events.controller';
import { MatchPointsController } from './api/match-points.controller';
import { MatchRulesetsController } from './api/match-rulesets.controller';
import { MatchStatisticsController } from './api/match-statistics.controller';
import { MatchesController } from './api/matches.controller';
import { CompleteMatchPointUseCase } from './application/complete-match-point.use-case';
import { CorrectMatchPlayUseCase } from './application/correct-match-play.use-case';
import { CreateMatchUseCase } from './application/create-match.use-case';
import { CreateMatchRulesetUseCase } from './application/create-match-ruleset.use-case';
import { FinalizeMatchUseCase } from './application/finalize-match.use-case';
import { MatchEventQueryService } from './application/match-event-query.service';
import { MatchLineupService } from './application/match-lineup.service';
import { MatchLookupService } from './application/match-lookup.service';
import { MatchPlayQueryService } from './application/match-play-query.service';
import { MatchPlayStreamService } from './application/match-play-stream.service';
import { MatchQueryService } from './application/match-query.service';
import { MatchRevisionQueryService } from './application/match-revision-query.service';
import { MatchRulesetQueryService } from './application/match-ruleset-query.service';
import { MatchScopeService } from './application/match-scope.service';
import { MatchScoreboardService } from './application/match-scoreboard.service';
import { MatchStatisticsService } from './application/match-statistics.service';
import { MatchStreamService } from './application/match-stream.service';
import { RebuildMatchStatisticsUseCase } from './application/rebuild-match-statistics.use-case';
import { RecordMatchPlayUseCase } from './application/record-match-play.use-case';
import { RecordMatchPointUseCase } from './application/record-match-point.use-case';
import { RecordMatchTimeoutUseCase } from './application/record-match-timeout.use-case';
import { ReopenMatchUseCase } from './application/reopen-match.use-case';
import { StartMatchPointUseCase } from './application/start-match-point.use-case';
import { TransitionMatchUseCase } from './application/transition-match.use-case';
import { VoidMatchEventUseCase } from './application/void-match-event.use-case';
import { MatchRepository } from './infrastructure/match.repository';
import { MatchEventRepository } from './infrastructure/match-event.repository';
import { MatchPlayEventRepository } from './infrastructure/match-play-event.repository';
import { MatchPointLineupRepository } from './infrastructure/match-point-lineup.repository';
import { MatchRevisionRepository } from './infrastructure/match-revision.repository';
import { MatchRosterRepository } from './infrastructure/match-roster.repository';
import { MatchRulesetRepository } from './infrastructure/match-ruleset.repository';
import { MatchScopeRepository } from './infrastructure/match-scope.repository';

/**
 * Match lifecycle and live scoreboard (UN-503): the authoritative match record
 * for a fixture, its state machine, the append-only score stream, caps and
 * timeouts read from a VERSIONED ruleset, and audited corrections. Owns its
 * persistence (raw SQL via the global UnitOfWorkPort) and composes the platform
 * audit + outbox primitives so every write commits atomically with its `match.*`
 * events.
 *
 * Score is a projection of accepted events, never an editable number. Scoring
 * operations are idempotent on a CLIENT operation id — the seam an offline
 * scorekeeper replays against. Finalizing publishes an immutable result: the
 * database rejects every in-place edit afterwards, and the only lawful path to a
 * different published score is an audited reopen that bumps the revision.
 *
 * Point lineups, possession events, and derived statistics (UN-504) extend the
 * same shape: a second append-only stream records which line took the field for
 * each point and every possession fact inside it, mistakes are undone by
 * APPENDING a compensating correction, and the per-player and per-team
 * statistics are a pure PROJECTION of that stream — rebuilt on every read, never
 * stored as an editable total, and identical whether the stream was clean or
 * corrected.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    MatchesController,
    MatchEventsController,
    MatchRulesetsController,
    MatchPointsController,
    MatchStatisticsController,
  ],
  providers: [
    MatchScopeRepository,
    MatchRulesetRepository,
    MatchRepository,
    MatchEventRepository,
    MatchRevisionRepository,
    MatchPlayEventRepository,
    MatchPointLineupRepository,
    MatchRosterRepository,
    MatchScopeService,
    MatchLookupService,
    MatchStreamService,
    MatchQueryService,
    MatchEventQueryService,
    MatchRevisionQueryService,
    MatchRulesetQueryService,
    MatchScoreboardService,
    CreateMatchRulesetUseCase,
    CreateMatchUseCase,
    TransitionMatchUseCase,
    RecordMatchPointUseCase,
    RecordMatchTimeoutUseCase,
    VoidMatchEventUseCase,
    FinalizeMatchUseCase,
    ReopenMatchUseCase,
    MatchPlayStreamService,
    MatchLineupService,
    MatchPlayQueryService,
    MatchStatisticsService,
    StartMatchPointUseCase,
    CompleteMatchPointUseCase,
    RecordMatchPlayUseCase,
    CorrectMatchPlayUseCase,
    RebuildMatchStatisticsUseCase,
  ],
})
export class MatchesModule {}
