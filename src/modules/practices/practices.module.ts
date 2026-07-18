import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { PracticeSchedulesController } from './api/practice-schedules.controller';
import { PracticeSessionsController } from './api/practice-sessions.controller';
import { ArchivePracticeScheduleUseCase } from './application/archive-practice-schedule.use-case';
import { CreatePracticeScheduleUseCase } from './application/create-practice-schedule.use-case';
import { CreatePracticeSessionUseCase } from './application/create-practice-session.use-case';
import { GenerateSessionsUseCase } from './application/generate-sessions.use-case';
import { PracticeLookupService } from './application/practice-lookup.service';
import { ReschedulePracticeSessionUseCase } from './application/reschedule-practice-session.use-case';
import { ScheduleQueryService } from './application/schedule-query.service';
import { ScopeValidationService } from './application/scope-validation.service';
import { SessionQueryService } from './application/session-query.service';
import { TransitionPracticeSessionUseCase } from './application/transition-practice-session.use-case';
import { UpdatePracticeScheduleUseCase } from './application/update-practice-schedule.use-case';
import { UpdatePracticeSessionUseCase } from './application/update-practice-session.use-case';
import { PracticeScheduleRepository } from './infrastructure/practice-schedule.repository';
import { PracticeScopeRepository } from './infrastructure/practice-scope.repository';
import { PracticeSessionRepository } from './infrastructure/practice-session.repository';
import { SessionStatusEventRepository } from './infrastructure/session-status-event.repository';

/**
 * Practices bounded context (schedules, recurrence, sessions, and cancellations).
 * Owns its persistence (raw SQL via the global UnitOfWorkPort), interprets weekly
 * and one-off recurrence in Africa/Cairo and stores unambiguous UTC instants,
 * generates stable session instances idempotently, and composes the platform
 * audit + transactional-outbox primitives (via PlatformModule) so every write is
 * audited and publish/reschedule/cancel emit versioned domain events. No other
 * module imports its internals.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [PracticeSchedulesController, PracticeSessionsController],
  providers: [
    PracticeScheduleRepository,
    PracticeSessionRepository,
    SessionStatusEventRepository,
    PracticeScopeRepository,
    PracticeLookupService,
    ScopeValidationService,
    CreatePracticeScheduleUseCase,
    UpdatePracticeScheduleUseCase,
    ArchivePracticeScheduleUseCase,
    GenerateSessionsUseCase,
    ScheduleQueryService,
    CreatePracticeSessionUseCase,
    UpdatePracticeSessionUseCase,
    TransitionPracticeSessionUseCase,
    ReschedulePracticeSessionUseCase,
    SessionQueryService,
  ],
})
export class PracticesModule {}
