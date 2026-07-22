import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { ManageTaskUseCase } from '../application/manage-task.use-case';
import { TaskQueryService } from '../application/task-query.service';
import { resolveGovernancePage } from '../lib/governance.helpers';
import {
  toTaskContent,
  toTaskListFilter,
} from '../lib/governance-command.mapper';
import {
  GOVERNANCE_API_TAG,
  TASK_ID_PARAM,
  TASK_ITEM_ROUTE,
  TASK_TRANSITION_ROUTE,
  TASKS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/governance.constants';
import {
  CreateTaskDto,
  GovernanceTaskResponseDto,
  ListGovernanceTasksResponseDto,
  TaskListQueryDto,
  TransitionTaskDto,
} from './dto/governance.dto';

/**
 * HTTP surface for governance tasks (governance.read / governance.manage).
 * Tasks carry owner, due date, priority, status, and dependencies; transitions
 * support reassignment, completion, and reopening.
 */
@ApiTags(GOVERNANCE_API_TAG)
@Controller(TASKS_ROUTE)
export class TasksController {
  constructor(
    private readonly query: TaskQueryService,
    private readonly tasks: ManageTaskUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.GovernanceRead)
  @ApiOperation({ summary: 'List governance tasks' })
  @ApiOkResponse({ type: ListGovernanceTasksResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: TaskListQueryDto,
  ): Promise<ListGovernanceTasksResponseDto> {
    return this.query.listForScope(
      teamId,
      toTaskListFilter(query),
      resolveGovernancePage(query.limit, query.offset),
    );
  }

  @Get(TASK_ITEM_ROUTE)
  @RequirePermissions(Permission.GovernanceRead)
  @ApiOperation({ summary: 'Get one governance task' })
  @ApiOkResponse({ type: GovernanceTaskResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(TASK_ID_PARAM, UuidValidationPipe) taskId: string,
  ): Promise<GovernanceTaskResponseDto> {
    return this.query.getById(teamId, taskId);
  }

  @Post()
  @RequirePermissions(Permission.GovernanceManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a governance task' })
  @ApiCreatedResponse({ type: GovernanceTaskResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GovernanceTaskResponseDto> {
    return this.tasks.create(actor, teamId, {
      content: toTaskContent(dto),
    });
  }

  @Post(TASK_TRANSITION_ROUTE)
  @RequirePermissions(Permission.GovernanceManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start, block, complete, cancel, or reopen a task' })
  @ApiOkResponse({ type: GovernanceTaskResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(TASK_ID_PARAM, UuidValidationPipe) taskId: string,
    @Body() dto: TransitionTaskDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GovernanceTaskResponseDto> {
    return this.tasks.transition(actor, teamId, taskId, {
      transition: dto.transition,
      ownerMembershipId: dto.ownerMembershipId ?? null,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
