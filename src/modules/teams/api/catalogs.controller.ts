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
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { ArchiveCatalogEntryUseCase } from '../application/archive-catalog-entry.use-case';
import { CatalogQueryService } from '../application/catalog-query.service';
import { CreateCatalogEntryUseCase } from '../application/create-catalog-entry.use-case';
import { resolvePage } from '../lib/teams.helpers';
import {
  CATALOG_ENTRIES_ROUTE,
  CATALOG_ENTRY_BY_ID_ROUTE,
  CATALOG_ENTRY_ID_PARAM,
  TEAM_ID_PARAM,
  TEAMS_API_TAG,
  TEAMS_ROUTE,
} from '../model/teams.constants';
import { CatalogEntryResponseDto } from './dto/catalog-entry-response.dto';
import { CatalogListQueryDto } from './dto/catalog-list-query.dto';
import { CreateCatalogEntryDto } from './dto/create-catalog-entry.dto';
import { ListCatalogEntriesResponseDto } from './dto/list-catalog-entries-response.dto';

@ApiTags(TEAMS_API_TAG)
@Controller(TEAMS_ROUTE)
export class CatalogsController {
  constructor(
    private readonly createEntry: CreateCatalogEntryUseCase,
    private readonly archiveEntry: ArchiveCatalogEntryUseCase,
    private readonly catalogQuery: CatalogQueryService,
  ) {}

  @Post(CATALOG_ENTRIES_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a reference catalog entry' })
  @ApiCreatedResponse({
    description: 'Catalog entry created',
    type: CatalogEntryResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateCatalogEntryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CatalogEntryResponseDto> {
    return this.createEntry.execute(actor, teamId, {
      catalog: dto.catalog,
      key: dto.key,
      label: dto.label,
      sortOrder: dto.sortOrder ?? null,
      metadata: dto.metadata ?? null,
    });
  }

  @Get(CATALOG_ENTRIES_ROUTE)
  @RequirePermissions(Permission.TeamRead)
  @ApiOperation({ summary: 'List reference catalog entries' })
  @ApiOkResponse({
    description: 'Catalog entries',
    type: ListCatalogEntriesResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: CatalogListQueryDto,
  ): Promise<ListCatalogEntriesResponseDto> {
    return this.catalogQuery.listEntries(
      teamId,
      query.catalog,
      resolvePage(query.limit, query.offset),
    );
  }

  @Delete(CATALOG_ENTRY_BY_ID_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @ApiOperation({ summary: 'Archive a reference catalog entry' })
  @ApiOkResponse({
    description: 'Catalog entry archived',
    type: CatalogEntryResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archive(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CATALOG_ENTRY_ID_PARAM, UuidValidationPipe) entryId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CatalogEntryResponseDto> {
    return this.archiveEntry.execute(actor, teamId, entryId);
  }
}
