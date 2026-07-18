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

import { ArchiveSeasonUseCase } from '../application/archive-season.use-case';
import { CreateSeasonUseCase } from '../application/create-season.use-case';
import { SeasonQueryService } from '../application/season-query.service';
import { UpdateSeasonUseCase } from '../application/update-season.use-case';
import { resolvePage } from '../lib/teams.helpers';
import {
  SEASON_BY_ID_ROUTE,
  SEASON_ID_PARAM,
  SEASONS_ROUTE,
  TEAM_ID_PARAM,
  TEAMS_API_TAG,
  TEAMS_ROUTE,
} from '../model/teams.constants';
import { CreateSeasonDto } from './dto/create-season.dto';
import { TeamListQueryDto } from './dto/list-query.dto';
import { ListSeasonsResponseDto } from './dto/list-seasons-response.dto';
import { SeasonResponseDto } from './dto/season-response.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

@ApiTags(TEAMS_API_TAG)
@Controller(TEAMS_ROUTE)
export class SeasonsController {
  constructor(
    private readonly createSeason: CreateSeasonUseCase,
    private readonly updateSeason: UpdateSeasonUseCase,
    private readonly archiveSeason: ArchiveSeasonUseCase,
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

  @Delete(SEASON_BY_ID_ROUTE)
  @RequirePermissions(Permission.SeasonManage)
  @ApiOperation({ summary: 'Archive a season' })
  @ApiOkResponse({ description: 'Season archived', type: SeasonResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archive(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SEASON_ID_PARAM, UuidValidationPipe) seasonId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SeasonResponseDto> {
    return this.archiveSeason.execute(actor, teamId, seasonId);
  }
}
