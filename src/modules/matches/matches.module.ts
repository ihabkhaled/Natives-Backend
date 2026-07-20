import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { MatchEventsController } from './api/match-events.controller';
import { MatchRulesetsController } from './api/match-rulesets.controller';
import { MatchesController } from './api/matches.controller';
import { CreateMatchUseCase } from './application/create-match.use-case';
import { CreateMatchRulesetUseCase } from './application/create-match-ruleset.use-case';
import { FinalizeMatchUseCase } from './application/finalize-match.use-case';
import { MatchEventQueryService } from './application/match-event-query.service';
import { MatchLookupService } from './application/match-lookup.service';
import { MatchQueryService } from './application/match-query.service';
import { MatchRevisionQueryService } from './application/match-revision-query.service';
import { MatchRulesetQueryService } from './application/match-ruleset-query.service';
import { MatchScopeService } from './application/match-scope.service';
import { MatchScoreboardService } from './application/match-scoreboard.service';
import { MatchStreamService } from './application/match-stream.service';
import { RecordMatchPointUseCase } from './application/record-match-point.use-case';
import { RecordMatchTimeoutUseCase } from './application/record-match-timeout.use-case';
import { ReopenMatchUseCase } from './application/reopen-match.use-case';
import { TransitionMatchUseCase } from './application/transition-match.use-case';
import { VoidMatchEventUseCase } from './application/void-match-event.use-case';
import { MatchRepository } from './infrastructure/match.repository';
import { MatchEventRepository } from './infrastructure/match-event.repository';
import { MatchRevisionRepository } from './infrastructure/match-revision.repository';
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
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    MatchesController,
    MatchEventsController,
    MatchRulesetsController,
  ],
  providers: [
    MatchScopeRepository,
    MatchRulesetRepository,
    MatchRepository,
    MatchEventRepository,
    MatchRevisionRepository,
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
  ],
})
export class MatchesModule {}
