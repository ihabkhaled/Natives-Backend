import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { AttendanceController } from './api/attendance.controller';
import { AttendanceParticipationController } from './api/attendance-participation.controller';
import { PracticeRsvpController } from './api/practice-rsvp.controller';
import { PracticeSchedulesController } from './api/practice-schedules.controller';
import { PracticeSessionsController } from './api/practice-sessions.controller';
import { ArchivePracticeScheduleUseCase } from './application/archive-practice-schedule.use-case';
import { AttendanceQueryService } from './application/attendance-query.service';
import { AttendanceRecorderService } from './application/attendance-recorder.service';
import { AttendanceSheetService } from './application/attendance-sheet.service';
import { CorrectAttendanceUseCase } from './application/correct-attendance.use-case';
import { CreatePracticeScheduleUseCase } from './application/create-practice-schedule.use-case';
import { CreatePracticeSessionUseCase } from './application/create-practice-session.use-case';
import { FinalizeAttendanceUseCase } from './application/finalize-attendance.use-case';
import { GenerateSessionsUseCase } from './application/generate-sessions.use-case';
import { OverrideRsvpUseCase } from './application/override-rsvp.use-case';
import { ParticipationQueryService } from './application/participation-query.service';
import { PracticeLookupService } from './application/practice-lookup.service';
import { RecordAttendanceUseCase } from './application/record-attendance.use-case';
import { ReschedulePracticeSessionUseCase } from './application/reschedule-practice-session.use-case';
import { RsvpQueryService } from './application/rsvp-query.service';
import { RsvpRecorderService } from './application/rsvp-recorder.service';
import { ScheduleQueryService } from './application/schedule-query.service';
import { ScopeValidationService } from './application/scope-validation.service';
import { SelfCheckInUseCase } from './application/self-check-in.use-case';
import { SessionQueryService } from './application/session-query.service';
import { SetOwnRsvpUseCase } from './application/set-own-rsvp.use-case';
import { TransitionPracticeSessionUseCase } from './application/transition-practice-session.use-case';
import { UpdatePracticeScheduleUseCase } from './application/update-practice-schedule.use-case';
import { UpdatePracticeSessionUseCase } from './application/update-practice-session.use-case';
import { AttendanceMembershipRepository } from './infrastructure/attendance-membership.repository';
import { AttendanceRecordRepository } from './infrastructure/attendance-record.repository';
import { AttendanceRecordRevisionRepository } from './infrastructure/attendance-record-revision.repository';
import { AttendanceScoringRuleRepository } from './infrastructure/attendance-scoring-rule.repository';
import { AttendanceSheetRepository } from './infrastructure/attendance-sheet.repository';
import { PracticeRsvpRepository } from './infrastructure/practice-rsvp.repository';
import { PracticeRsvpRevisionRepository } from './infrastructure/practice-rsvp-revision.repository';
import { PracticeScheduleRepository } from './infrastructure/practice-schedule.repository';
import { PracticeScopeRepository } from './infrastructure/practice-scope.repository';
import { PracticeSessionRepository } from './infrastructure/practice-session.repository';
import { RsvpMembershipRepository } from './infrastructure/rsvp-membership.repository';
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
  controllers: [
    PracticeSchedulesController,
    PracticeSessionsController,
    PracticeRsvpController,
    AttendanceController,
    AttendanceParticipationController,
  ],
  providers: [
    PracticeScheduleRepository,
    PracticeSessionRepository,
    SessionStatusEventRepository,
    PracticeScopeRepository,
    PracticeRsvpRepository,
    PracticeRsvpRevisionRepository,
    RsvpMembershipRepository,
    AttendanceSheetRepository,
    AttendanceRecordRepository,
    AttendanceRecordRevisionRepository,
    AttendanceScoringRuleRepository,
    AttendanceMembershipRepository,
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
    RsvpRecorderService,
    SetOwnRsvpUseCase,
    OverrideRsvpUseCase,
    RsvpQueryService,
    AttendanceSheetService,
    AttendanceRecorderService,
    RecordAttendanceUseCase,
    SelfCheckInUseCase,
    FinalizeAttendanceUseCase,
    CorrectAttendanceUseCase,
    AttendanceQueryService,
    ParticipationQueryService,
  ],
})
export class PracticesModule {}
