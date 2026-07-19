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
  Put,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { CreateGoalUseCase } from '../application/create-goal.use-case';
import { GoalQueryService } from '../application/goal-query.service';
import { ReviewGoalUseCase } from '../application/review-goal.use-case';
import { TransitionGoalUseCase } from '../application/transition-goal.use-case';
import { UpdateGoalUseCase } from '../application/update-goal.use-case';
import { resolveDevelopmentPage } from '../lib/development.helpers';
import { toGoalContent } from '../lib/development-command.mapper';
import {
  DEVELOPMENT_API_TAG,
  DEVELOPMENT_GOALS_ROUTE,
  GOAL_DETAIL_ROUTE,
  GOAL_ID_PARAM,
  GOAL_REVIEW_ROUTE,
  GOAL_TRANSITION_ROUTE,
  TEAM_ID_PARAM,
} from '../model/development.constants';
import { CreateGoalDto } from './dto/create-goal.dto';
import { DevelopmentGoalResponseDto } from './dto/development-goal-response.dto';
import { ListDevelopmentQueryDto } from './dto/list-development.query.dto';
import { ListDevelopmentGoalsResponseDto } from './dto/list-development-goals.response.dto';
import { ReviewGoalDto } from './dto/review-goal.dto';
import { TransitionGoalDto } from './dto/transition-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

/**
 * Team-facing development-goal surface for feedback managers (feedback.manage):
 * create/update goals with action plans, move them through their lifecycle, and
 * record coach reviews. Every list is bounded and deterministically ordered.
 */
@ApiTags(DEVELOPMENT_API_TAG)
@Controller(DEVELOPMENT_GOALS_ROUTE)
export class DevelopmentGoalController {
  constructor(
    private readonly query: GoalQueryService,
    private readonly createGoal: CreateGoalUseCase,
    private readonly updateGoal: UpdateGoalUseCase,
    private readonly transitionGoal: TransitionGoalUseCase,
    private readonly reviewGoal: ReviewGoalUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.FeedbackManage)
  @ApiOperation({ summary: 'List a team’s development goals' })
  @ApiOkResponse({ type: ListDevelopmentGoalsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListDevelopmentQueryDto,
  ): Promise<ListDevelopmentGoalsResponseDto> {
    return this.query.listForTeam(
      teamId,
      resolveDevelopmentPage(query.limit, query.offset),
    );
  }

  @Get(GOAL_DETAIL_ROUTE)
  @RequirePermissions(Permission.FeedbackManage)
  @ApiOperation({ summary: 'Read one development goal with its action plan' })
  @ApiOkResponse({ type: DevelopmentGoalResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  detail(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(GOAL_ID_PARAM, UuidValidationPipe) goalId: string,
  ): Promise<DevelopmentGoalResponseDto> {
    return this.query.getDetail(teamId, goalId);
  }

  @Post()
  @RequirePermissions(Permission.FeedbackManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a proposed development goal' })
  @ApiCreatedResponse({ type: DevelopmentGoalResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateGoalDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<DevelopmentGoalResponseDto> {
    return this.createGoal.execute(actor, teamId, {
      membershipId: dto.membershipId,
      seasonId: dto.seasonId ?? null,
      content: toGoalContent(dto),
    });
  }

  @Put(GOAL_DETAIL_ROUTE)
  @RequirePermissions(Permission.FeedbackManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a development goal and its action plan' })
  @ApiOkResponse({ type: DevelopmentGoalResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(GOAL_ID_PARAM, UuidValidationPipe) goalId: string,
    @Body() dto: UpdateGoalDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<DevelopmentGoalResponseDto> {
    return this.updateGoal.execute(actor, teamId, goalId, {
      expectedRecordVersion: dto.expectedRecordVersion,
      content: toGoalContent(dto),
    });
  }

  @Post(GOAL_TRANSITION_ROUTE)
  @RequirePermissions(Permission.FeedbackManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move a development goal through its lifecycle' })
  @ApiOkResponse({ type: DevelopmentGoalResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(GOAL_ID_PARAM, UuidValidationPipe) goalId: string,
    @Body() dto: TransitionGoalDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<DevelopmentGoalResponseDto> {
    return this.transitionGoal.execute(actor, teamId, goalId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(GOAL_REVIEW_ROUTE)
  @RequirePermissions(Permission.FeedbackManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a coach review of a development goal' })
  @ApiOkResponse({ type: DevelopmentGoalResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  review(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(GOAL_ID_PARAM, UuidValidationPipe) goalId: string,
    @Body() dto: ReviewGoalDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<DevelopmentGoalResponseDto> {
    return this.reviewGoal.execute(actor, teamId, goalId, {
      expectedRecordVersion: dto.expectedRecordVersion,
      reviewNote: dto.reviewNote ?? null,
      progressValue: dto.progressValue ?? null,
      progressNote: dto.progressNote ?? null,
      evidence: dto.evidence ?? null,
    });
  }
}
