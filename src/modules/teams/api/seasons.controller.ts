import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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

import { CreateSeasonUseCase } from '../application/create-season.use-case';
import { SeasonQueryService } from '../application/season-query.service';
import { TransitionSeasonUseCase } from '../application/transition-season.use-case';
import { UpdateSeasonUseCase } from '../application/update-season.use-case';
import { resolvePage, toTransitionCommand } from '../lib/teams.helpers';
import {
  CURRENT_SEASON_ROUTE,
  SEASON_ACTIVATE_ROUTE,
  SEASON_ARCHIVE_ROUTE,
  SEASON_BY_ID_ROUTE,
  SEASON_CLOSE_ROUTE,
  SEASON_ID_PARAM,
  SEASONS_ROUTE,
  TEAM_ID_PARAM,
  TEAMS_API_TAG,
  TEAMS_ROUTE,
} from '../model/teams.constants';
import { SeasonStatus } from '../model/teams.enums';
import { CreateSeasonDto } from './dto/create-season.dto';
import { TeamListQueryDto } from './dto/list-query.dto';
import { ListSeasonsResponseDto } from './dto/list-seasons-response.dto';
import { SeasonResponseDto } from './dto/season-response.dto';
import { TeamTransitionDto } from './dto/transition.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

@ApiTags(TEAMS_API_TAG)
@Controller(TEAMS_ROUTE)
export class SeasonsController {
  constructor(
    private readonly createSeason: CreateSeasonUseCase,
    private readonly updateSeason: UpdateSeasonUseCase,
    private readonly transitionSeason: TransitionSeasonUseCase,
    private readonly seasonQuery: SeasonQueryService,
  ) {}

  @Post(SEASONS_ROUTE)
  @RequirePermissions(Permission.SeasonManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a season within a team' })
  @ApiCreatedResponse({
    description: 'Season created',
    type: SeasonResponseDto,
  })
  @ApiConflictResponse({
    description: 'Overlap, slug or active-season conflict',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateSeasonDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SeasonResponseDto> {
    return this.createSeason.execute(actor, teamId, {
      slug: dto.slug,
      name: dto.name,
      startsOn: dto.startsOn,
      endsOn: dto.endsOn,
      status: dto.status ?? null,
    });
  }

  @Get(CURRENT_SEASON_ROUTE)
  @RequirePermissions(Permission.TeamRead)
  @ApiOperation({
    summary: 'Resolve the team single current (active) season',
  })
  @ApiOkResponse({ description: 'Current season', type: SeasonResponseDto })
  @ApiNotFoundResponse({ description: 'The team has no active season' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  current(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
  ): Promise<SeasonResponseDto> {
    return this.seasonQuery.getCurrentSeason(teamId);
  }

  @Get(SEASONS_ROUTE)
  @RequirePermissions(Permission.TeamRead)
  @ApiOperation({ summary: 'List seasons for a team' })
  @ApiOkResponse({ description: 'Seasons', type: ListSeasonsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: TeamListQueryDto,
  ): Promise<ListSeasonsResponseDto> {
    return this.seasonQuery.listSeasons(
      teamId,
      resolvePage(query.limit, query.offset),
    );
  }

  @Patch(SEASON_BY_ID_ROUTE)
  @RequirePermissions(Permission.SeasonManage)
  @ApiOperation({ summary: 'Update a season' })
  @ApiOkResponse({ description: 'Season updated', type: SeasonResponseDto })
  @ApiConflictResponse({ description: 'Overlap, slug or version conflict' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SEASON_ID_PARAM, UuidValidationPipe) seasonId: string,
    @Body() dto: UpdateSeasonDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SeasonResponseDto> {
    return this.updateSeason.execute(actor, teamId, seasonId, {
      slug: dto.slug,
      name: dto.name,
      startsOn: dto.startsOn,
      endsOn: dto.endsOn,
      status: dto.status,
      expectedVersion: dto.expectedVersion,
    });
  }

  @Post(SEASON_ACTIVATE_ROUTE)
  @RequirePermissions(Permission.SeasonManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate a season as the team single current season',
  })
  @ApiOkResponse({ description: 'Season activated', type: SeasonResponseDto })
  @ApiConflictResponse({
    description:
      'Invalid transition, version conflict or season already active',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  activate(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SEASON_ID_PARAM, UuidValidationPipe) seasonId: string,
    @Body() dto: TeamTransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SeasonResponseDto> {
    return this.transitionSeason.execute(
      actor,
      teamId,
      seasonId,
      SeasonStatus.Active,
      toTransitionCommand(dto.expectedVersion),
    );
  }

  @Post(SEASON_CLOSE_ROUTE)
  @RequirePermissions(Permission.SeasonManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close an active season' })
  @ApiOkResponse({ description: 'Season closed', type: SeasonResponseDto })
  @ApiConflictResponse({
    description: 'Invalid transition or version conflict',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  close(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SEASON_ID_PARAM, UuidValidationPipe) seasonId: string,
    @Body() dto: TeamTransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SeasonResponseDto> {
    return this.transitionSeason.execute(
      actor,
      teamId,
      seasonId,
      SeasonStatus.Closed,
      toTransitionCommand(dto.expectedVersion),
    );
  }

  @Post(SEASON_ARCHIVE_ROUTE)
  @RequirePermissions(Permission.SeasonManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a season (history preserved)' })
  @ApiOkResponse({ description: 'Season archived', type: SeasonResponseDto })
  @ApiConflictResponse({
    description: 'Invalid transition or version conflict',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archiveTransition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SEASON_ID_PARAM, UuidValidationPipe) seasonId: string,
    @Body() dto: TeamTransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SeasonResponseDto> {
    return this.transitionSeason.execute(
      actor,
      teamId,
      seasonId,
      SeasonStatus.Archived,
      toTransitionCommand(dto.expectedVersion),
    );
  }

  @Delete(SEASON_BY_ID_ROUTE)
  @RequirePermissions(Permission.SeasonManage)
  @ApiOperation({ summary: 'Archive a season (soft; alias of POST /archive)' })
  @ApiOkResponse({ description: 'Season archived', type: SeasonResponseDto })
  @ApiConflictResponse({ description: 'Invalid transition' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archive(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SEASON_ID_PARAM, UuidValidationPipe) seasonId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SeasonResponseDto> {
    return this.transitionSeason.execute(
      actor,
      teamId,
      seasonId,
      SeasonStatus.Archived,
      toTransitionCommand(undefined),
    );
  }
}
