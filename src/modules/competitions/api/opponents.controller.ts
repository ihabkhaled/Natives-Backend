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

import { CreateOpponentUseCase } from '../application/create-opponent.use-case';
import { OpponentQueryService } from '../application/opponent-query.service';
import { resolveCompetitionsPage } from '../lib/competitions.helpers';
import { toOpponentContent } from '../lib/competitions-command.mapper';
import {
  COMPETITIONS_API_TAG,
  OPPONENTS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/competitions.constants';
import { CreateOpponentDto } from './dto/create-opponent.dto';
import { ListQueryDto } from './dto/list.query.dto';
import { ListOpponentsResponseDto } from './dto/list-opponents.response.dto';
import { OpponentResponseDto } from './dto/opponent-response.dto';

/**
 * HTTP surface for the opponent catalogue: a bounded read of a team's opponents
 * (competition.read) and cataloguing a new external team (competition.manage).
 * Identity comes from the token; the team scope is enforced by the guard and the
 * application layer.
 */
@ApiTags(COMPETITIONS_API_TAG)
@Controller(OPPONENTS_ROUTE)
export class OpponentsController {
  constructor(
    private readonly query: OpponentQueryService,
    private readonly createOpponent: CreateOpponentUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.CompetitionRead)
  @ApiOperation({ summary: 'List a team’s opponent catalogue' })
  @ApiOkResponse({ type: ListOpponentsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListQueryDto,
  ): Promise<ListOpponentsResponseDto> {
    return this.query.listForTeam(
      teamId,
      resolveCompetitionsPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Catalogue a new opponent' })
  @ApiCreatedResponse({ type: OpponentResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateOpponentDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<OpponentResponseDto> {
    return this.createOpponent.execute(actor, teamId, {
      content: toOpponentContent(dto),
    });
  }
}
