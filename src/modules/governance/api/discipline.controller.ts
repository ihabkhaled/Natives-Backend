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

import { DisciplineQueryService } from '../application/discipline-query.service';
import { OpenDisciplineCaseUseCase } from '../application/open-discipline-case.use-case';
import { TransitionDisciplineCaseUseCase } from '../application/transition-discipline-case.use-case';
import { resolveGovernancePage } from '../lib/governance.helpers';
import {
  toDisciplineContent,
  toDisciplineListFilter,
} from '../lib/governance-command.mapper';
import {
  CASE_ID_PARAM,
  CASE_ITEM_ROUTE,
  CASE_TRANSITION_ROUTE,
  DISCIPLINE_ROUTE,
  GOVERNANCE_API_TAG,
  TEAM_ID_PARAM,
} from '../model/governance.constants';
import {
  DisciplineCaseResponseDto,
  DisciplineListQueryDto,
  ListDisciplineCasesResponseDto,
  OpenDisciplineCaseDto,
  TransitionDisciplineCaseDto,
} from './dto/governance.dto';

/**
 * HTTP surface for discipline cases — the whole surface is gated behind
 * discipline.read (reads) and discipline.manage (writes), so the confidential
 * case data never reaches a caller without the dedicated permission. Opening and
 * transitioning enforce a fair, human-driven process with separation of duties.
 */
@ApiTags(GOVERNANCE_API_TAG)
@Controller(DISCIPLINE_ROUTE)
export class DisciplineController {
  constructor(
    private readonly query: DisciplineQueryService,
    private readonly openCase: OpenDisciplineCaseUseCase,
    private readonly transitionCase: TransitionDisciplineCaseUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.DisciplineRead)
  @ApiOperation({ summary: 'List discipline cases' })
  @ApiOkResponse({ type: ListDisciplineCasesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: DisciplineListQueryDto,
  ): Promise<ListDisciplineCasesResponseDto> {
    return this.query.listForScope(
      teamId,
      toDisciplineListFilter(query),
      resolveGovernancePage(query.limit, query.offset),
    );
  }

  @Get(CASE_ITEM_ROUTE)
  @RequirePermissions(Permission.DisciplineRead)
  @ApiOperation({ summary: 'Get one discipline case' })
  @ApiOkResponse({ type: DisciplineCaseResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CASE_ID_PARAM, UuidValidationPipe) caseId: string,
  ): Promise<DisciplineCaseResponseDto> {
    return this.query.getById(teamId, caseId);
  }

  @Post()
  @RequirePermissions(Permission.DisciplineManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open a discipline case' })
  @ApiCreatedResponse({ type: DisciplineCaseResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  open(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: OpenDisciplineCaseDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<DisciplineCaseResponseDto> {
    return this.openCase.execute(actor, teamId, {
      content: toDisciplineContent(dto),
    });
  }

  @Post(CASE_TRANSITION_ROUTE)
  @RequirePermissions(Permission.DisciplineManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance a discipline case through its process' })
  @ApiOkResponse({ type: DisciplineCaseResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CASE_ID_PARAM, UuidValidationPipe) caseId: string,
    @Body() dto: TransitionDisciplineCaseDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<DisciplineCaseResponseDto> {
    return this.transitionCase.execute(actor, teamId, caseId, {
      transition: dto.transition,
      note: dto.note ?? null,
      action: dto.action ?? null,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
