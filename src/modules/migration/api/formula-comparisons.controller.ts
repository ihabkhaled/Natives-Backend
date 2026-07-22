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

import { CompareFormulaUseCase } from '../application/compare-formula.use-case';
import { MigrationQueryService } from '../application/migration-query.service';
import { resolveMigrationPage } from '../lib/migration.helpers';
import {
  toComparisonListFilter,
  toRecordComparisonCommand,
} from '../lib/migration-command.mapper';
import {
  COMPARISON_ID_PARAM,
  COMPARISON_ITEM_ROUTE,
  COMPARISON_SIGNOFF_ROUTE,
  COMPARISONS_ROUTE,
  MIGRATION_API_TAG,
  TEAM_ID_PARAM,
} from '../model/migration.constants';
import {
  ComparisonListQueryDto,
  FormulaComparisonResponseDto,
  ListFormulaComparisonsResponseDto,
  RecordComparisonDto,
  SignOffComparisonDto,
} from './dto/migration.dto';

/**
 * HTTP surface for legacy formula comparison and sign-off (import.manage reads,
 * import.signoff to sign). Recording classifies a target-vs-legacy difference;
 * sign-off is the named human approval required before production import.
 */
@ApiTags(MIGRATION_API_TAG)
@Controller(COMPARISONS_ROUTE)
export class FormulaComparisonsController {
  constructor(
    private readonly query: MigrationQueryService,
    private readonly compare: CompareFormulaUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.ImportManage)
  @ApiOperation({ summary: 'List formula comparisons' })
  @ApiOkResponse({ type: ListFormulaComparisonsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ComparisonListQueryDto,
  ): Promise<ListFormulaComparisonsResponseDto> {
    return this.query.listComparisons(
      teamId,
      toComparisonListFilter(query),
      resolveMigrationPage(query.limit, query.offset),
    );
  }

  @Get(COMPARISON_ITEM_ROUTE)
  @RequirePermissions(Permission.ImportManage)
  @ApiOperation({ summary: 'Get one formula comparison' })
  @ApiOkResponse({ type: FormulaComparisonResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPARISON_ID_PARAM, UuidValidationPipe) comparisonId: string,
  ): Promise<FormulaComparisonResponseDto> {
    return this.query.getComparison(teamId, comparisonId);
  }

  @Post()
  @RequirePermissions(Permission.ImportManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a target-vs-legacy comparison' })
  @ApiCreatedResponse({ type: FormulaComparisonResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  record(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: RecordComparisonDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<FormulaComparisonResponseDto> {
    return this.compare.record(actor, teamId, toRecordComparisonCommand(dto));
  }

  @Post(COMPARISON_SIGNOFF_ROUTE)
  @RequirePermissions(Permission.ImportSignoff)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign off a comparison for production import' })
  @ApiOkResponse({ type: FormulaComparisonResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  signOff(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(COMPARISON_ID_PARAM, UuidValidationPipe) comparisonId: string,
    @Body() dto: SignOffComparisonDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<FormulaComparisonResponseDto> {
    return this.compare.signOff(actor, teamId, comparisonId, {
      signedOffByName: dto.signedOffByName,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
