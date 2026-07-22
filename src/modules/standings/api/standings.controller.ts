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

import { RecomputeStandingsUseCase } from '../application/recompute-standings.use-case';
import { RecordManualStandingUseCase } from '../application/record-manual-standing.use-case';
import { StandingsQueryService } from '../application/standings-query.service';
import { resolveTablePage } from '../lib/standings.helpers';
import {
  toManualStandingContent,
  toStandingListFilter,
} from '../lib/standings-command.mapper';
import {
  STANDINGS_API_TAG,
  STANDINGS_MANUAL_ROUTE,
  STANDINGS_RECOMPUTE_ROUTE,
  STANDINGS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/standings.constants';
import {
  ListStandingsResponseDto,
  RecomputeStandingsDto,
  RecordManualStandingDto,
  StandingListQueryDto,
  StandingResponseDto,
  StandingsRecomputeReportDto,
} from './dto/standings.dto';

/**
 * HTTP surface for competition standings: the bounded, rule-version-ordered
 * table (competition.read), deriving it from finalized matches, and recording an
 * external or historical row with its mandatory reconciliation note
 * (competition.manage).
 */
@ApiTags(STANDINGS_API_TAG)
@Controller(STANDINGS_ROUTE)
export class StandingsController {
  constructor(
    private readonly query: StandingsQueryService,
    private readonly recompute: RecomputeStandingsUseCase,
    private readonly manual: RecordManualStandingUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.CompetitionRead)
  @ApiOperation({ summary: 'Read a competition standings table' })
  @ApiOkResponse({ type: ListStandingsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: StandingListQueryDto,
  ): Promise<ListStandingsResponseDto> {
    return this.query.listForScope(
      teamId,
      toStandingListFilter(query),
      resolveTablePage(query.limit, query.offset),
    );
  }

  @Post(STANDINGS_RECOMPUTE_ROUTE)
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Derive standings from finalized matches' })
  @ApiOkResponse({ type: StandingsRecomputeReportDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  recomputeTable(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: RecomputeStandingsDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<StandingsRecomputeReportDto> {
    return this.recompute.execute(actor, teamId, {
      competitionId: dto.competitionId,
      ruleKey: dto.ruleKey,
    });
  }

  @Post(STANDINGS_MANUAL_ROUTE)
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record an external or reconciled standings row' })
  @ApiCreatedResponse({ type: StandingResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  recordManual(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: RecordManualStandingDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<StandingResponseDto> {
    return this.manual.execute(actor, teamId, {
      content: toManualStandingContent(dto),
    });
  }
}
