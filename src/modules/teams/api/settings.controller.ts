import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
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

import { CancelSettingVersionUseCase } from '../application/cancel-setting-version.use-case';
import { CreateSettingVersionUseCase } from '../application/create-setting-version.use-case';
import { SettingsQueryService } from '../application/settings-query.service';
import { resolvePage } from '../lib/teams.helpers';
import {
  SETTING_VERSION_ID_PARAM,
  SETTING_VERSION_ROUTE,
  SETTING_VERSIONS_ROUTE,
  SETTINGS_SNAPSHOT_ROUTE,
  TEAM_ID_PARAM,
  TEAMS_API_TAG,
  TEAMS_ROUTE,
} from '../model/teams.constants';
import { CreateSettingVersionDto } from './dto/create-setting-version.dto';
import {
  CREATE_SETTING_VERSION_BODY_SCHEMA,
  CREATE_SETTING_VERSION_REQUEST_DTOS,
} from './dto/create-setting-version-request.dto';
import { ListSettingVersionsResponseDto } from './dto/list-setting-versions-response.dto';
import { SETTING_VALUE_DTOS } from './dto/setting-values';
import { SettingVersionResponseDto } from './dto/setting-version-response.dto';
import { SettingVersionsQueryDto } from './dto/setting-versions-query.dto';
import { SettingsSnapshotResponseDto } from './dto/settings-snapshot-response.dto';
import { SnapshotQueryDto } from './dto/snapshot-query.dto';

@ApiTags(TEAMS_API_TAG)
@ApiExtraModels(...CREATE_SETTING_VERSION_REQUEST_DTOS, ...SETTING_VALUE_DTOS)
@Controller(TEAMS_ROUTE)
export class SettingsController {
  constructor(
    private readonly createVersion: CreateSettingVersionUseCase,
    private readonly cancelVersion: CancelSettingVersionUseCase,
    private readonly settingsQuery: SettingsQueryService,
  ) {}

  @Post(SETTING_VERSIONS_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an effective-dated setting version' })
  @ApiBody({ schema: CREATE_SETTING_VERSION_BODY_SCHEMA })
  @ApiCreatedResponse({
    description: 'Setting version created',
    type: SettingVersionResponseDto,
  })
  @ApiConflictResponse({
    description: 'Duplicate effective instant or stale head guard',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  createSettingVersion(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateSettingVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SettingVersionResponseDto> {
    return this.createVersion.execute(actor, teamId, {
      settingKey: dto.settingKey,
      effectiveFrom: dto.effectiveFrom,
      value: dto.value,
      note: dto.note,
      expectedHeadVersionId: dto.expectedHeadVersionId,
    });
  }

  @Delete(SETTING_VERSION_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a future-effective setting version' })
  @ApiNoContentResponse({ description: 'Future setting version cancelled' })
  @ApiConflictResponse({ description: 'Version already in effect' })
  @ApiNotFoundResponse({ description: 'Version not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  cancelSettingVersion(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SETTING_VERSION_ID_PARAM, UuidValidationPipe) versionId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<void> {
    return this.cancelVersion.execute(actor, teamId, versionId);
  }

  @Get(SETTING_VERSIONS_ROUTE)
  @RequirePermissions(Permission.TeamSettingsRead)
  @ApiOperation({ summary: 'List setting versions for a key' })
  @ApiOkResponse({
    description: 'Setting versions',
    type: ListSettingVersionsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listSettingVersions(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: SettingVersionsQueryDto,
  ): Promise<ListSettingVersionsResponseDto> {
    return this.settingsQuery.listVersions(
      teamId,
      query.settingKey,
      resolvePage(query.limit, query.offset),
    );
  }

  @Get(SETTINGS_SNAPSHOT_ROUTE)
  @RequirePermissions(Permission.TeamSettingsRead)
  @ApiOperation({ summary: 'Resolve the effective settings snapshot' })
  @ApiOkResponse({
    description: 'Effective settings snapshot',
    type: SettingsSnapshotResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  snapshot(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: SnapshotQueryDto,
  ): Promise<SettingsSnapshotResponseDto> {
    return this.settingsQuery.getSnapshot(teamId, query.asOf ?? null);
  }
}
