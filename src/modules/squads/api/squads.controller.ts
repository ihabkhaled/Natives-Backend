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

import { CreateSquadUseCase } from '../application/create-squad.use-case';
import { EligibilityReportService } from '../application/eligibility-report.service';
import { SquadQueryService } from '../application/squad-query.service';
import { TransitionSquadUseCase } from '../application/transition-squad.use-case';
import {
  resolveEligibilityPage,
  resolveSquadsPage,
} from '../lib/squads.helpers';
import { toSquadContent } from '../lib/squads-command.mapper';
import {
  SQUAD_ELIGIBILITY_ROUTE,
  SQUAD_ID_PARAM,
  SQUAD_ITEM_ROUTE,
  SQUAD_TRANSITION_ROUTE,
  SQUADS_API_TAG,
  SQUADS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/squads.constants';
import { CreateSquadDto } from './dto/create-squad.dto';
import { EligibilityQueryDto } from './dto/eligibility.query.dto';
import { EligibilityReportResponseDto } from './dto/eligibility-report.response.dto';
import { ListSquadsQueryDto } from './dto/list-squads.query.dto';
import { ListSquadsResponseDto } from './dto/list-squads.response.dto';
import { SquadResponseDto } from './dto/squad-response.dto';
import { TransitionSquadDto } from './dto/transition-squad.dto';

/**
 * HTTP surface for squads: a bounded read of a team's squads and the advisory
 * eligibility report (squad.read), and the draft → published → locked → archived
 * management lifecycle (squad.manage). Identity comes from the token; the team
 * scope is enforced by the permissions guard and the application.
 */
@ApiTags(SQUADS_API_TAG)
@Controller(SQUADS_ROUTE)
export class SquadsController {
  constructor(
    private readonly query: SquadQueryService,
    private readonly eligibilityReport: EligibilityReportService,
    private readonly createSquad: CreateSquadUseCase,
    private readonly transitionSquad: TransitionSquadUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.SquadRead)
  @ApiOperation({ summary: 'List a team’s squads' })
  @ApiOkResponse({ type: ListSquadsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListSquadsQueryDto,
  ): Promise<ListSquadsResponseDto> {
    return this.query.listForScope(
      teamId,
      query.seasonId ?? null,
      resolveSquadsPage(query.limit, query.offset),
    );
  }

  @Get(SQUAD_ITEM_ROUTE)
  @RequirePermissions(Permission.SquadRead)
  @ApiOperation({ summary: 'Get one squad' })
  @ApiOkResponse({ type: SquadResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SQUAD_ID_PARAM, UuidValidationPipe) squadId: string,
  ): Promise<SquadResponseDto> {
    return this.query.getById(teamId, squadId);
  }

  @Get(SQUAD_ELIGIBILITY_ROUTE)
  @RequirePermissions(Permission.SquadRead)
  @ApiOperation({
    summary: 'Advisory eligibility signals for the candidate pool',
  })
  @ApiOkResponse({ type: EligibilityReportResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  eligibility(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SQUAD_ID_PARAM, UuidValidationPipe) squadId: string,
    @Query() query: EligibilityQueryDto,
  ): Promise<EligibilityReportResponseDto> {
    return this.eligibilityReport.report(
      teamId,
      squadId,
      resolveEligibilityPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.SquadManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft squad' })
  @ApiCreatedResponse({ type: SquadResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateSquadDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SquadResponseDto> {
    return this.createSquad.execute(actor, teamId, {
      content: toSquadContent(dto),
    });
  }

  @Post(SQUAD_TRANSITION_ROUTE)
  @RequirePermissions(Permission.SquadManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish, lock, revise, or archive a squad' })
  @ApiOkResponse({ type: SquadResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SQUAD_ID_PARAM, UuidValidationPipe) squadId: string,
    @Body() dto: TransitionSquadDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SquadResponseDto> {
    return this.transitionSquad.execute(actor, teamId, squadId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
