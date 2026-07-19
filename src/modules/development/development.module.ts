import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { CoachFeedbackController } from './api/coach-feedback.controller';
import { CoachFeedbackSelfController } from './api/coach-feedback-self.controller';
import { DevelopmentGoalController } from './api/development-goal.controller';
import { DevelopmentGoalSelfController } from './api/development-goal-self.controller';
import { DevelopmentReminderController } from './api/development-reminder.controller';
import { AcknowledgeFeedbackUseCase } from './application/acknowledge-feedback.use-case';
import { CorrectFeedbackUseCase } from './application/correct-feedback.use-case';
import { CreateFeedbackUseCase } from './application/create-feedback.use-case';
import { CreateGoalUseCase } from './application/create-goal.use-case';
import { DevelopmentScopeService } from './application/development-scope.service';
import { EnqueueDevelopmentRemindersUseCase } from './application/enqueue-development-reminders.use-case';
import { FeedbackLookupService } from './application/feedback-lookup.service';
import { FeedbackQueryService } from './application/feedback-query.service';
import { GoalLookupService } from './application/goal-lookup.service';
import { GoalQueryService } from './application/goal-query.service';
import { PublishFeedbackUseCase } from './application/publish-feedback.use-case';
import { ReviewGoalUseCase } from './application/review-goal.use-case';
import { SubmitFeedbackUseCase } from './application/submit-feedback.use-case';
import { TransitionGoalUseCase } from './application/transition-goal.use-case';
import { UpdateFeedbackUseCase } from './application/update-feedback.use-case';
import { UpdateGoalUseCase } from './application/update-goal.use-case';
import { CoachFeedbackRepository } from './infrastructure/coach-feedback.repository';
import { DevelopmentGoalRepository } from './infrastructure/development-goal.repository';
import { DevelopmentScopeRepository } from './infrastructure/development-scope.repository';

/**
 * Player development bounded context (UN-302): private coach feedback with
 * explicit field visibility (the coach note never reaches a member view, a broad
 * list, an event payload, or an audit diff), a draft → in_review → published →
 * revised workflow with immutable published revisions, member acknowledgement and
 * clarification, measurable development goals with action plans and a lifecycle,
 * and privacy-safe reminders for unacknowledged feedback and overdue goals. Owns
 * its persistence (raw SQL via the global UnitOfWorkPort) and composes the
 * platform audit + outbox primitives so every write is recorded atomically.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    CoachFeedbackController,
    CoachFeedbackSelfController,
    DevelopmentGoalController,
    DevelopmentGoalSelfController,
    DevelopmentReminderController,
  ],
  providers: [
    DevelopmentScopeRepository,
    CoachFeedbackRepository,
    DevelopmentGoalRepository,
    DevelopmentScopeService,
    FeedbackLookupService,
    FeedbackQueryService,
    GoalLookupService,
    GoalQueryService,
    CreateFeedbackUseCase,
    UpdateFeedbackUseCase,
    SubmitFeedbackUseCase,
    PublishFeedbackUseCase,
    CorrectFeedbackUseCase,
    AcknowledgeFeedbackUseCase,
    CreateGoalUseCase,
    UpdateGoalUseCase,
    TransitionGoalUseCase,
    ReviewGoalUseCase,
    EnqueueDevelopmentRemindersUseCase,
  ],
})
export class DevelopmentModule {}
