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

import { ArchiveTeamUseCase } from '../application/archive-team.use-case';
import { CreateTeamUseCase } from '../application/create-team.use-case';
import { TeamQueryService } from '../application/team-query.service';
import { UpdateTeamUseCase } from '../application/update-team.use-case';
import { resolvePage } from '../lib/teams.helpers';
import {
  TEAM_BY_ID_ROUTE,
  TEAM_ID_PARAM,
  TEAMS_API_TAG,
  TEAMS_ROUTE,
} from '../model/teams.constants';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { ListTeamsResponseDto } from './dto/list-teams-response.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@ApiTags(TEAMS_API_TAG)
@Controller(TEAMS_ROUTE)
export class TeamsController {
  constructor(
    private readonly createTeam: CreateTeamUseCase,
    private readonly updateTeam: UpdateTeamUseCase,
    private readonly archiveTeam: ArchiveTeamUseCase,
    private readonly teamQuery: TeamQueryService,
  ) {}

  @Post()
  @RequirePermissions(Permission.TeamSettingsManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a team' })
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

  @Get()
  @RequirePermissions(Permission.TeamRead)
  @ApiOperation({ summary: 'List teams' })
  @ApiOkResponse({ description: 'Teams', type: ListTeamsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(@Query() query: ListQueryDto): Promise<ListTeamsResponseDto> {
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
  @ApiOperation({ summary: 'Update a team' })
  @ApiOkResponse({ description: 'Team updated', type: TeamResponseDto })
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

  @Delete(TEAM_BY_ID_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @ApiOperation({ summary: 'Archive a team' })
  @ApiOkResponse({ description: 'Team archived', type: TeamResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archive(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TeamResponseDto> {
    return this.archiveTeam.execute(actor, teamId);
  }
}
