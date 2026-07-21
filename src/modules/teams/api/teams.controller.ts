import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiConflictResponse,
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
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { CreateTeamUseCase } from '../application/create-team.use-case';
import { RemoveTeamUseCase } from '../application/remove-team.use-case';
import { TeamQueryService } from '../application/team-query.service';
import { TransitionTeamUseCase } from '../application/transition-team.use-case';
import { UpdateTeamUseCase } from '../application/update-team.use-case';
import { resolvePage, toTransitionCommand } from '../lib/teams.helpers';
import {
  MY_TEAMS_ROUTE,
  TEAM_ACTIVATE_ROUTE,
  TEAM_ARCHIVE_ROUTE,
  TEAM_BY_ID_ROUTE,
  TEAM_DEACTIVATE_ROUTE,
  TEAM_ID_PARAM,
  TEAM_REMOVE_ROUTE,
  TEAMS_API_TAG,
  TEAMS_ROUTE,
} from '../model/teams.constants';
import { TeamStatus } from '../model/teams.enums';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamListQueryDto } from './dto/list-query.dto';
import { ListTeamsResponseDto } from './dto/list-teams-response.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { TeamTransitionDto } from './dto/transition.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@ApiTags(TEAMS_API_TAG)
@Controller(TEAMS_ROUTE)
export class TeamsController {
  constructor(
    private readonly createTeam: CreateTeamUseCase,
    private readonly updateTeam: UpdateTeamUseCase,
    private readonly transitionTeam: TransitionTeamUseCase,
    private readonly removeTeam: RemoveTeamUseCase,
    private readonly teamQuery: TeamQueryService,
  ) {}

  @Post()
  @RequirePermissions(Permission.TeamCreate)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a team (platform-scoped: super administrators only)',
  })
  @ApiCreatedResponse({ description: 'Team created', type: TeamResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Body() dto: CreateTeamDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TeamResponseDto> {
    return this.createTeam.execute(actor, {
      slug: dto.slug,
      name: dto.name,
      locale: dto.locale ?? null,
      timezone: dto.timezone ?? null,
      primaryColor: dto.primaryColor ?? null,
      logoMediaKey: dto.logoMediaKey ?? null,
    });
  }

  @Get(MY_TEAMS_ROUTE)
  @RequirePermissions(Permission.TeamRead)
  @ApiOperation({ summary: 'List the teams the caller belongs to' })
  @ApiOkResponse({ description: 'Teams', type: ListTeamsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listMine(
    @CurrentUser() actor: AuthUserIdentity,
    @Query() query: TeamListQueryDto,
  ): Promise<ListTeamsResponseDto> {
    return this.teamQuery.listMyTeams(
      actor.userId,
      resolvePage(query.limit, query.offset),
    );
  }

  @Get()
  @RequirePermissions(Permission.TeamBrowseAll)
  @ApiOperation({
    summary: 'Browse every team (platform-scoped: super administrators only)',
  })
  @ApiOkResponse({ description: 'Teams', type: ListTeamsResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(@Query() query: TeamListQueryDto): Promise<ListTeamsResponseDto> {
    return this.teamQuery.listTeams(resolvePage(query.limit, query.offset));
  }

  @Get(TEAM_BY_ID_ROUTE)
  @RequirePermissions(Permission.TeamRead)
  @ApiOperation({ summary: 'Get a team by id' })
  @ApiOkResponse({ description: 'Team', type: TeamResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
  ): Promise<TeamResponseDto> {
    return this.teamQuery.getTeam(teamId);
  }

  @Patch(TEAM_BY_ID_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @ApiOperation({ summary: 'Rename or rebrand a team' })
  @ApiOkResponse({ description: 'Team updated', type: TeamResponseDto })
  @ApiConflictResponse({ description: 'Version conflict' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TeamResponseDto> {
    return this.updateTeam.execute(actor, teamId, {
      name: dto.name,
      locale: dto.locale ?? null,
      timezone: dto.timezone ?? null,
      primaryColor: dto.primaryColor ?? null,
      logoMediaKey: dto.logoMediaKey ?? null,
      expectedVersion: dto.expectedVersion,
    });
  }

  @Post(TEAM_ACTIVATE_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable (activate) a disabled or archived team' })
  @ApiOkResponse({ description: 'Team activated', type: TeamResponseDto })
  @ApiConflictResponse({
    description: 'Invalid transition or version conflict',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  activate(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: TeamTransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TeamResponseDto> {
    return this.transitionTeam.execute(
      actor,
      teamId,
      TeamStatus.Active,
      toTransitionCommand(dto.expectedVersion),
    );
  }

  @Post(TEAM_DEACTIVATE_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable (deactivate) an active team' })
  @ApiOkResponse({ description: 'Team disabled', type: TeamResponseDto })
  @ApiConflictResponse({
    description: 'Invalid transition or version conflict',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  deactivate(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: TeamTransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TeamResponseDto> {
    return this.transitionTeam.execute(
      actor,
      teamId,
      TeamStatus.Disabled,
      toTransitionCommand(dto.expectedVersion),
    );
  }

  @Post(TEAM_ARCHIVE_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a team (history preserved)' })
  @ApiOkResponse({ description: 'Team archived', type: TeamResponseDto })
  @ApiConflictResponse({
    description: 'Invalid transition or version conflict',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archiveTransition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: TeamTransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TeamResponseDto> {
    return this.transitionTeam.execute(
      actor,
      teamId,
      TeamStatus.Archived,
      toTransitionCommand(dto.expectedVersion),
    );
  }

  @Post(TEAM_REMOVE_ROUTE)
  @RequirePermissions(Permission.PlatformAdmin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Soft-remove an archived team (platform-scoped; never a hard delete)',
  })
  @ApiOkResponse({ description: 'Team soft-removed', type: TeamResponseDto })
  @ApiConflictResponse({
    description: 'Invalid transition or version conflict',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  remove(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: TeamTransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TeamResponseDto> {
    return this.removeTeam.execute(
      actor,
      teamId,
      toTransitionCommand(dto.expectedVersion),
    );
  }

  @Delete(TEAM_BY_ID_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @ApiOperation({ summary: 'Archive a team (soft; alias of POST /archive)' })
  @ApiOkResponse({ description: 'Team archived', type: TeamResponseDto })
  @ApiConflictResponse({ description: 'Invalid transition' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archive(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TeamResponseDto> {
    return this.transitionTeam.execute(
      actor,
      teamId,
      TeamStatus.Archived,
      toTransitionCommand(undefined),
    );
  }
}
