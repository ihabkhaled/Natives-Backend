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

import { AssessmentQueryService } from '../application/assessment-query.service';
import { CreatePeriodUseCase } from '../application/create-period.use-case';
import { resolveAssessmentPage } from '../lib/assessments.helpers';
import {
  ASSESSMENT_CATALOG_ROUTE,
  ASSESSMENT_PERIODS_ROUTE,
  ASSESSMENTS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/assessments.constants';
import { CreatePeriodDto } from './dto/create-period.dto';
import { ListCatalogQueryDto } from './dto/list-catalog.query.dto';
import { ListPeriodsResponseDto } from './dto/list-periods.response.dto';
import { PeriodResponseDto } from './dto/period-response.dto';

@ApiTags(ASSESSMENTS_API_TAG)
@Controller(ASSESSMENT_CATALOG_ROUTE)
export class AssessmentPeriodController {
  constructor(
    private readonly query: AssessmentQueryService,
    private readonly createPeriod: CreatePeriodUseCase,
  ) {}

  @Get(ASSESSMENT_PERIODS_ROUTE)
  @RequirePermissions(Permission.AssessmentReadTeam)
  @ApiOperation({ summary: 'List assessment periods for a team' })
  @ApiOkResponse({ description: 'Periods', type: ListPeriodsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListCatalogQueryDto,
  ): Promise<ListPeriodsResponseDto> {
    return this.query.listPeriods(
      teamId,
      resolveAssessmentPage(query.limit, query.offset),
    );
  }

  @Post(ASSESSMENT_PERIODS_ROUTE)
  @RequirePermissions(Permission.AssessmentCreate)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Open an assessment period for a published template',
  })
  @ApiCreatedResponse({
    description: 'Period created',
    type: PeriodResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreatePeriodDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PeriodResponseDto> {
    return this.createPeriod.execute(actor, teamId, {
      seasonId: dto.seasonId ?? null,
      templateId: dto.templateId,
      name: dto.name,
      cohort: dto.cohort ?? null,
      startsOn: dto.startsOn,
      endsOn: dto.endsOn,
    });
  }
}
