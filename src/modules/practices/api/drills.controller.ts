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
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { DrillCatalogService } from '../application/drill-catalog.service';
import { DrillQueryService } from '../application/drill-query.service';
import {
  DRILL_ARCHIVE_ROUTE,
  DRILL_BY_ID_ROUTE,
  DRILL_ID_PARAM,
  DRILLS_ROUTE,
} from '../model/agendas.constants';
import { DrillIntensity } from '../model/agendas.enums';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import { CreateDrillDto } from './dto/create-drill.dto';
import { DrillResponseDto } from './dto/drill-response.dto';
import { ListDrillsQueryDto } from './dto/list-drills.query.dto';
import { ListDrillsResponseDto } from './dto/list-drills-response.dto';
import { UpdateDrillDto } from './dto/update-drill.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class DrillsController {
  constructor(
    private readonly catalog: DrillCatalogService,
    private readonly query: DrillQueryService,
  ) {}

  @Post(DRILLS_ROUTE)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Create a reusable catalog drill' })
  @ApiCreatedResponse({ description: 'Created', type: DrillResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  createDrill(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateDrillDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<DrillResponseDto> {
    return this.catalog.createDrill(actor, teamId, {
      seasonId: dto.seasonId ?? null,
      name: dto.name,
      category: dto.category,
      objective: dto.objective ?? null,
      instructions: dto.instructions ?? null,
      equipment: dto.equipment ?? [],
      intensity: dto.intensity ?? DrillIntensity.Moderate,
      defaultDurationMinutes: dto.defaultDurationMinutes ?? null,
      skillTags: dto.skillTags ?? [],
      safetyNotes: dto.safetyNotes ?? null,
      mediaUrl: dto.mediaUrl ?? null,
    });
  }

  @Get(DRILLS_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'List catalog drills (bounded, filtered)' })
  @ApiOkResponse({ description: 'Drills', type: ListDrillsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listDrills(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListDrillsQueryDto,
  ): Promise<ListDrillsResponseDto> {
    return this.query.list(teamId, query);
  }

  @Get(DRILL_BY_ID_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'Get one catalog drill' })
  @ApiOkResponse({ description: 'Drill', type: DrillResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getDrill(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(DRILL_ID_PARAM, UuidValidationPipe) drillId: string,
  ): Promise<DrillResponseDto> {
    return this.query.getDrill(teamId, drillId);
  }

  @Patch(DRILL_BY_ID_ROUTE)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Update a catalog drill' })
  @ApiOkResponse({ description: 'Updated', type: DrillResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  updateDrill(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(DRILL_ID_PARAM, UuidValidationPipe) drillId: string,
    @Body() dto: UpdateDrillDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<DrillResponseDto> {
    return this.catalog.updateDrill(actor, teamId, drillId, {
      name: dto.name,
      category: dto.category,
      objective: dto.objective ?? null,
      instructions: dto.instructions ?? null,
      equipment: dto.equipment ?? [],
      intensity: dto.intensity ?? DrillIntensity.Moderate,
      defaultDurationMinutes: dto.defaultDurationMinutes ?? null,
      skillTags: dto.skillTags ?? [],
      safetyNotes: dto.safetyNotes ?? null,
      mediaUrl: dto.mediaUrl ?? null,
      expectedVersion: dto.expectedVersion ?? null,
    });
  }

  @Post(DRILL_ARCHIVE_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Archive a catalog drill (retire; never deletes)' })
  @ApiOkResponse({ description: 'Archived', type: DrillResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archiveDrill(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(DRILL_ID_PARAM, UuidValidationPipe) drillId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<DrillResponseDto> {
    return this.catalog.archiveDrill(actor, teamId, drillId);
  }
}
