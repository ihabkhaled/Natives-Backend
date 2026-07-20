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

import { CreateCompetitionRosterUseCase } from '../application/create-competition-roster.use-case';
import { CreateMatchRosterUseCase } from '../application/create-match-roster.use-case';
import { LockRosterUseCase } from '../application/lock-roster.use-case';
import { ReviseRosterUseCase } from '../application/revise-roster.use-case';
import { RosterQueryService } from '../application/roster-query.service';
import { RosterValidationService } from '../application/roster-validation.service';
import { TransitionRosterUseCase } from '../application/transition-roster.use-case';
import { resolveRostersPage } from '../lib/rosters.helpers';
import {
  toCompetitionRosterContent,
  toMatchRosterContent,
  toRosterListFilter,
} from '../lib/rosters-command.mapper';
import {
  MATCH_ROSTER_ROUTE,
  ROSTER_ID_PARAM,
  ROSTER_ITEM_ROUTE,
  ROSTER_LOCK_ROUTE,
  ROSTER_REVISION_ROUTE,
  ROSTER_TRANSITION_ROUTE,
  ROSTER_VALIDATION_ROUTE,
  ROSTERS_API_TAG,
  ROSTERS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/rosters.constants';
import { CreateCompetitionRosterDto } from './dto/create-competition-roster.dto';
import { CreateMatchRosterDto } from './dto/create-match-roster.dto';
import { ListRostersResponseDto } from './dto/list-rosters.response.dto';
import { LockRosterDto } from './dto/lock-roster.dto';
import { ReviseRosterDto } from './dto/revise-roster.dto';
import { RosterListQueryDto } from './dto/roster-list.query.dto';
import { RosterResponseDto } from './dto/roster-response.dto';
import { RosterValidationResponseDto } from './dto/roster-validation.response.dto';
import { TransitionRosterDto } from './dto/transition-roster.dto';

/**
 * HTTP surface for competition and match rosters: bounded reads and the
 * validation preview (roster.read), the draft → published lifecycle
 * (roster.manage), and the elevated freeze/supersede operations (roster.lock).
 * Locking and revising are separate routes precisely so they can carry the
 * higher permission. Identity comes from the token; the team scope is enforced
 * by the permissions guard and the application.
 */
@ApiTags(ROSTERS_API_TAG)
@Controller(ROSTERS_ROUTE)
export class RostersController {
  constructor(
    private readonly query: RosterQueryService,
    private readonly validation: RosterValidationService,
    private readonly createCompetitionRoster: CreateCompetitionRosterUseCase,
    private readonly createMatchRoster: CreateMatchRosterUseCase,
    private readonly transitionRoster: TransitionRosterUseCase,
    private readonly lockRoster: LockRosterUseCase,
    private readonly reviseRoster: ReviseRosterUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.RosterRead)
  @ApiOperation({ summary: 'List a team’s competition and match rosters' })
  @ApiOkResponse({ type: ListRostersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: RosterListQueryDto,
  ): Promise<ListRostersResponseDto> {
    return this.query.listForScope(
      teamId,
      toRosterListFilter(query),
      resolveRostersPage(query.limit, query.offset),
    );
  }

  @Get(ROSTER_ITEM_ROUTE)
  @RequirePermissions(Permission.RosterRead)
  @ApiOperation({ summary: 'Get one roster' })
  @ApiOkResponse({ type: RosterResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
  ): Promise<RosterResponseDto> {
    return this.query.getById(teamId, rosterId);
  }

  @Get(ROSTER_VALIDATION_ROUTE)
  @RequirePermissions(Permission.RosterRead)
  @ApiOperation({ summary: 'Preview the server-side composition validation' })
  @ApiOkResponse({ type: RosterValidationResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  validate(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
  ): Promise<RosterValidationResponseDto> {
    return this.validation.preview(teamId, rosterId);
  }

  @Post()
  @RequirePermissions(Permission.RosterManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft competition roster' })
  @ApiCreatedResponse({ type: RosterResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateCompetitionRosterDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RosterResponseDto> {
    return this.createCompetitionRoster.execute(actor, teamId, {
      content: toCompetitionRosterContent(dto),
    });
  }

  @Post(MATCH_ROSTER_ROUTE)
  @RequirePermissions(Permission.RosterManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft match roster for a fixture' })
  @ApiCreatedResponse({ type: RosterResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  createMatch(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateMatchRosterDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RosterResponseDto> {
    return this.createMatchRoster.execute(actor, teamId, {
      content: toMatchRosterContent(dto),
    });
  }

  @Post(ROSTER_TRANSITION_ROUTE)
  @RequirePermissions(Permission.RosterManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish or archive a roster' })
  @ApiOkResponse({ type: RosterResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
    @Body() dto: TransitionRosterDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RosterResponseDto> {
    return this.transitionRoster.execute(actor, teamId, rosterId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(ROSTER_LOCK_ROUTE)
  @RequirePermissions(Permission.RosterLock)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Freeze a published roster and snapshot it' })
  @ApiOkResponse({ type: RosterResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  lock(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
    @Body() dto: LockRosterDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RosterResponseDto> {
    return this.lockRoster.execute(actor, teamId, rosterId, {
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(ROSTER_REVISION_ROUTE)
  @RequirePermissions(Permission.RosterManage, Permission.RosterLock)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Supersede a published or locked roster with a new revision',
  })
  @ApiCreatedResponse({ type: RosterResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  revise(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ROSTER_ID_PARAM, UuidValidationPipe) rosterId: string,
    @Body() dto: ReviseRosterDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RosterResponseDto> {
    return this.reviseRoster.execute(actor, teamId, rosterId, {
      reason: dto.reason,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
