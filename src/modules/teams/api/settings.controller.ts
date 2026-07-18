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

import { CreateSettingVersionUseCase } from '../application/create-setting-version.use-case';
import { SettingsQueryService } from '../application/settings-query.service';
import { resolvePage } from '../lib/teams.helpers';
import {
  SETTING_VERSIONS_ROUTE,
  SETTINGS_SNAPSHOT_ROUTE,
  TEAM_ID_PARAM,
  TEAMS_API_TAG,
  TEAMS_ROUTE,
} from '../model/teams.constants';
import { CreateSettingVersionDto } from './dto/create-setting-version.dto';
import { ListSettingVersionsResponseDto } from './dto/list-setting-versions-response.dto';
import { SettingVersionResponseDto } from './dto/setting-version-response.dto';
import { SettingVersionsQueryDto } from './dto/setting-versions-query.dto';
import { SettingsSnapshotResponseDto } from './dto/settings-snapshot-response.dto';
import { SnapshotQueryDto } from './dto/snapshot-query.dto';

@ApiTags(TEAMS_API_TAG)
@Controller(TEAMS_ROUTE)
export class SettingsController {
  constructor(
    private readonly createVersion: CreateSettingVersionUseCase,
    private readonly settingsQuery: SettingsQueryService,
  ) {}

  @Post(SETTING_VERSIONS_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an effective-dated setting version' })
  @ApiCreatedResponse({
    description: 'Setting version created',
    type: SettingVersionResponseDto,
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
      note: dto.note ?? null,
    });
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
