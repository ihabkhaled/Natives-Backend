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

import { CompetitionQueryService } from '../application/competition-query.service';
import { CreateCompetitionUseCase } from '../application/create-competition.use-case';
import { TransitionCompetitionUseCase } from '../application/transition-competition.use-case';
import { resolveCompetitionsPage } from '../lib/competitions.helpers';
import { toCompetitionContent } from '../lib/competitions-command.mapper';
import {
  COMPETITION_ID_PARAM,
  COMPETITION_ITEM_ROUTE,
  COMPETITION_TRANSITION_ROUTE,
  COMPETITIONS_API_TAG,
  COMPETITIONS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/competitions.constants';
import { CompetitionResponseDto } from './dto/competition-response.dto';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { ListCompetitionsQueryDto } from './dto/list-competitions.query.dto';
import { ListCompetitionsResponseDto } from './dto/list-competitions.response.dto';
import { TransitionCompetitionDto } from './dto/transition-competition.dto';

/**
 * HTTP surface for competitions: a bounded read of a team's competitions
 * (competition.read) and the draft → published → active → completed / cancelled →
 * archived management lifecycle (competition.manage). Identity comes from the
 * token; the team scope is enforced by the permissions guard and the application.
 */
@ApiTags(COMPETITIONS_API_TAG)
@Controller(COMPETITIONS_ROUTE)
export class CompetitionsController {
  constructor(
    private readonly query: CompetitionQueryService,
    private readonly createCompetition: CreateCompetitionUseCase,
    private readonly transitionCompetition: TransitionCompetitionUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.CompetitionRead)
  @ApiOperation({ summary: 'List a team’s competitions' })
  @ApiOkResponse({ type: ListCompetitionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListCompetitionsQueryDto,
  ): Promise<ListCompetitionsResponseDto> {
    return this.query.listForScope(
      teamId,
      query.seasonId ?? null,
      resolveCompetitionsPage(query.limit, query.offset),
    );
  }

  @Get(COMPETITION_ITEM_ROUTE)
  @RequirePermissions(Permission.CompetitionRead)
  @ApiOperation({ summary: 'Get one competition' })
  @ApiOkResponse({ type: CompetitionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPETITION_ID_PARAM, UuidValidationPipe) competitionId: string,
  ): Promise<CompetitionResponseDto> {
    return this.query.getById(teamId, competitionId);
  }

  @Post()
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft competition' })
  @ApiCreatedResponse({ type: CompetitionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateCompetitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CompetitionResponseDto> {
    return this.createCompetition.execute(actor, teamId, {
      content: toCompetitionContent(dto),
    });
  }

  @Post(COMPETITION_TRANSITION_ROUTE)
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish, activate, complete, cancel, or archive' })
  @ApiOkResponse({ type: CompetitionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPETITION_ID_PARAM, UuidValidationPipe) competitionId: string,
    @Body() dto: TransitionCompetitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CompetitionResponseDto> {
    return this.transitionCompetition.execute(actor, teamId, competitionId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
      reason: dto.reason ?? null,
    });
  }
}
