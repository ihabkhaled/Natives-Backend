import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { RosterAvailabilityController } from './api/roster-availability.controller';
import { RosterEntriesController } from './api/roster-entries.controller';
import { RosterSnapshotsController } from './api/roster-snapshots.controller';
import { RostersController } from './api/rosters.controller';
import { AddRosterEntryUseCase } from './application/add-roster-entry.use-case';
import { CreateCompetitionRosterUseCase } from './application/create-competition-roster.use-case';
import { CreateMatchRosterUseCase } from './application/create-match-roster.use-case';
import { DeclareRosterAvailabilityUseCase } from './application/declare-roster-availability.use-case';
import { LockRosterUseCase } from './application/lock-roster.use-case';
import { RemoveRosterEntryUseCase } from './application/remove-roster-entry.use-case';
import { ReviseRosterUseCase } from './application/revise-roster.use-case';
import { RosterAvailabilityQueryService } from './application/roster-availability-query.service';
import { RosterEntryQueryService } from './application/roster-entry-query.service';
import { RosterLookupService } from './application/roster-lookup.service';
import { RosterQueryService } from './application/roster-query.service';
import { RosterScopeService } from './application/roster-scope.service';
import { RosterSnapshotQueryService } from './application/roster-snapshot-query.service';
import { RosterSnapshotRecorderService } from './application/roster-snapshot-recorder.service';
import { RosterValidationService } from './application/roster-validation.service';
import { TransitionRosterUseCase } from './application/transition-roster.use-case';
import { RosterRepository } from './infrastructure/roster.repository';
import { RosterAvailabilityRepository } from './infrastructure/roster-availability.repository';
import { RosterEntryRepository } from './infrastructure/roster-entry.repository';
import { RosterScopeRepository } from './infrastructure/roster-scope.repository';
import { RosterSnapshotRepository } from './infrastructure/roster-snapshot.repository';
import { RosterSourceRepository } from './infrastructure/roster-source.repository';

/**
 * Competition and match rosters (UN-502): a roster is the selected line-up for a
 * competition (drawn from the season squad) or for one fixture. Owns its
 * persistence (raw SQL via the global UnitOfWorkPort) and composes the platform
 * audit + outbox primitives so every write commits atomically with its `roster.*`
 * events.
 *
 * Publishing and locking freeze IMMUTABLE snapshots: a later squad or roster
 * change can never alter a recorded selection. Correcting a frozen roster creates
 * a revision that supersedes it — history is added to, never rewritten. Match
 * play and scoring are later prompts and are not built here.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    RostersController,
    RosterEntriesController,
    RosterAvailabilityController,
    RosterSnapshotsController,
  ],
  providers: [
    RosterScopeRepository,
    RosterRepository,
    RosterEntryRepository,
    RosterAvailabilityRepository,
    RosterSnapshotRepository,
    RosterSourceRepository,
    RosterScopeService,
    RosterLookupService,
    RosterQueryService,
    RosterEntryQueryService,
    RosterAvailabilityQueryService,
    RosterSnapshotQueryService,
    RosterValidationService,
    RosterSnapshotRecorderService,
    CreateCompetitionRosterUseCase,
    CreateMatchRosterUseCase,
    AddRosterEntryUseCase,
    RemoveRosterEntryUseCase,
    DeclareRosterAvailabilityUseCase,
    TransitionRosterUseCase,
    LockRosterUseCase,
    ReviseRosterUseCase,
  ],
})
export class RostersModule {}
