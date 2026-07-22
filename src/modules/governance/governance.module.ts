import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { RbacModule } from '@modules/rbac';
import { Module } from '@nestjs/common';

import { DisciplineController } from './api/discipline.controller';
import { MeetingsController } from './api/meetings.controller';
import { PositionsController } from './api/positions.controller';
import { RulesController } from './api/rules.controller';
import { TasksController } from './api/tasks.controller';
import { AcknowledgeRuleUseCase } from './application/acknowledge-rule.use-case';
import { DirectoryQueryService } from './application/directory-query.service';
import { DisciplineQueryService } from './application/discipline-query.service';
import { GovernanceAuthorityService } from './application/governance-authority.service';
import { GovernanceLookupService } from './application/governance-lookup.service';
import { ManageDirectoryUseCase } from './application/manage-directory.use-case';
import { ManageMeetingUseCase } from './application/manage-meeting.use-case';
import { ManageTaskUseCase } from './application/manage-task.use-case';
import { MeetingQueryService } from './application/meeting-query.service';
import { OpenDisciplineCaseUseCase } from './application/open-discipline-case.use-case';
import { PublishRuleUseCase } from './application/publish-rule.use-case';
import { RuleQueryService } from './application/rule-query.service';
import { TaskQueryService } from './application/task-query.service';
import { TransitionDisciplineCaseUseCase } from './application/transition-discipline-case.use-case';
import { DisciplineRepository } from './infrastructure/discipline.repository';
import { GovernanceDirectoryRepository } from './infrastructure/governance-directory.repository';
import { GovernanceScopeRepository } from './infrastructure/governance-scope.repository';
import { MeetingRepository } from './infrastructure/meeting.repository';
import { RuleRepository } from './infrastructure/rule.repository';
import { TaskRepository } from './infrastructure/task.repository';

/**
 * Team rules, discipline, and governance (UN-602, UN-603). Owns its persistence
 * (raw SQL via the global UnitOfWorkPort) and composes the platform audit +
 * outbox primitives so every write commits atomically with its `governance.*`
 * events.
 *
 * Three invariants shape the module. Rules are VERSIONED and acknowledgements
 * cite the version accepted. Discipline is HIGHLY RESTRICTED, gated behind a
 * dedicated permission, driven by humans with separation of duties, and never
 * affects public rank — the legacy attendance concern is an eligibility signal,
 * not a punishment. A governance TITLE is not an application PERMISSION: holding
 * one grants no authority, and meeting minutes carry a visibility class so board
 * discussions never leak to the whole team.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule, RbacModule],
  controllers: [
    RulesController,
    DisciplineController,
    PositionsController,
    MeetingsController,
    TasksController,
  ],
  providers: [
    GovernanceScopeRepository,
    RuleRepository,
    DisciplineRepository,
    GovernanceDirectoryRepository,
    MeetingRepository,
    TaskRepository,
    GovernanceLookupService,
    GovernanceAuthorityService,
    RuleQueryService,
    DisciplineQueryService,
    DirectoryQueryService,
    MeetingQueryService,
    TaskQueryService,
    PublishRuleUseCase,
    AcknowledgeRuleUseCase,
    OpenDisciplineCaseUseCase,
    TransitionDisciplineCaseUseCase,
    ManageDirectoryUseCase,
    ManageMeetingUseCase,
    ManageTaskUseCase,
  ],
})
export class GovernanceModule {}
