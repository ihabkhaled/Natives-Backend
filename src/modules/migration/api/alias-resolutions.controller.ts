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

import { MigrationQueryService } from '../application/migration-query.service';
import { ResolveAliasUseCase } from '../application/resolve-alias.use-case';
import { resolveMigrationPage } from '../lib/migration.helpers';
import { toAliasListFilter } from '../lib/migration-command.mapper';
import {
  ALIASES_ROUTE,
  MIGRATION_API_TAG,
  RESOLUTION_ID_PARAM,
  RESOLUTION_ITEM_ROUTE,
  RESOLUTION_REVIEW_ROUTE,
  TEAM_ID_PARAM,
} from '../model/migration.constants';
import {
  AliasListQueryDto,
  AliasResolutionResponseDto,
  ListAliasResolutionsResponseDto,
  RegisterAliasDto,
  ReviewAliasDto,
} from './dto/migration.dto';

/**
 * HTTP surface for legacy alias resolution (import.manage). Registration
 * proposes a candidate; review is the human confirm/reject/quarantine that
 * prevents a silent merge of two distinct people.
 */
@ApiTags(MIGRATION_API_TAG)
@Controller(ALIASES_ROUTE)
export class AliasResolutionsController {
  constructor(
    private readonly query: MigrationQueryService,
    private readonly resolve: ResolveAliasUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.ImportManage)
  @ApiOperation({ summary: 'List legacy alias resolutions' })
  @ApiOkResponse({ type: ListAliasResolutionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: AliasListQueryDto,
  ): Promise<ListAliasResolutionsResponseDto> {
    return this.query.listAliases(
      teamId,
      toAliasListFilter(query),
      resolveMigrationPage(query.limit, query.offset),
    );
  }

  @Get(RESOLUTION_ITEM_ROUTE)
  @RequirePermissions(Permission.ImportManage)
  @ApiOperation({ summary: 'Get one alias resolution' })
  @ApiOkResponse({ type: AliasResolutionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RESOLUTION_ID_PARAM, UuidValidationPipe) resolutionId: string,
  ): Promise<AliasResolutionResponseDto> {
    return this.query.getAlias(teamId, resolutionId);
  }

  @Post()
  @RequirePermissions(Permission.ImportManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a legacy alias for resolution' })
  @ApiCreatedResponse({ type: AliasResolutionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  register(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: RegisterAliasDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AliasResolutionResponseDto> {
    return this.resolve.register(actor, teamId, {
      sourceAlias: dto.sourceAlias,
      candidateMembershipId: dto.candidateMembershipId ?? null,
    });
  }

  @Post(RESOLUTION_REVIEW_ROUTE)
  @RequirePermissions(Permission.ImportManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm, reject, or quarantine a resolution' })
  @ApiOkResponse({ type: AliasResolutionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  review(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(RESOLUTION_ID_PARAM, UuidValidationPipe) resolutionId: string,
    @Body() dto: ReviewAliasDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AliasResolutionResponseDto> {
    return this.resolve.review(actor, teamId, resolutionId, {
      status: dto.status,
      resolvedMembershipId: dto.resolvedMembershipId ?? null,
      override: dto.override ?? false,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
