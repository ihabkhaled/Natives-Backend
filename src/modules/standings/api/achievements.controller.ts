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

import { AchievementQueryService } from '../application/achievement-query.service';
import { CreateAchievementUseCase } from '../application/create-achievement.use-case';
import { ImportAchievementsUseCase } from '../application/import-achievements.use-case';
import { TransitionAchievementUseCase } from '../application/transition-achievement.use-case';
import { resolveStandingsPage } from '../lib/standings.helpers';
import {
  toAchievementContent,
  toAchievementImportRows,
  toAchievementListFilter,
} from '../lib/standings-command.mapper';
import {
  ACHIEVEMENT_ID_PARAM,
  ACHIEVEMENT_IMPORT_ROUTE,
  ACHIEVEMENT_ITEM_ROUTE,
  ACHIEVEMENT_TRANSITION_ROUTE,
  ACHIEVEMENTS_ROUTE,
  STANDINGS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/standings.constants';
import {
  AchievementImportReportDto,
  AchievementListQueryDto,
  AchievementResponseDto,
  CreateAchievementDto,
  ImportAchievementsDto,
  ListAchievementsResponseDto,
  TransitionAchievementDto,
} from './dto/standings.dto';

/**
 * HTTP surface for team and player achievements: bounded reads
 * (competition.read), claim authoring, the approval workflow, and the audited
 * historical import (competition.manage + import.manage). Only an APPROVED
 * achievement reaches the team history cabinet.
 */
@ApiTags(STANDINGS_API_TAG)
@Controller(ACHIEVEMENTS_ROUTE)
export class AchievementsController {
  constructor(
    private readonly query: AchievementQueryService,
    private readonly createAchievement: CreateAchievementUseCase,
    private readonly transitionAchievement: TransitionAchievementUseCase,
    private readonly importAchievements: ImportAchievementsUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.CompetitionRead)
  @ApiOperation({ summary: 'List a team’s achievements' })
  @ApiOkResponse({ type: ListAchievementsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: AchievementListQueryDto,
  ): Promise<ListAchievementsResponseDto> {
    return this.query.listForScope(
      teamId,
      toAchievementListFilter(query),
      resolveStandingsPage(query.limit, query.offset),
    );
  }

  @Get(ACHIEVEMENT_ITEM_ROUTE)
  @RequirePermissions(Permission.CompetitionRead)
  @ApiOperation({ summary: 'Get one achievement' })
  @ApiOkResponse({ type: AchievementResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ACHIEVEMENT_ID_PARAM, UuidValidationPipe) achievementId: string,
  ): Promise<AchievementResponseDto> {
    return this.query.getById(teamId, achievementId);
  }

  @Post()
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft achievement claim' })
  @ApiCreatedResponse({ type: AchievementResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateAchievementDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AchievementResponseDto> {
    return this.createAchievement.execute(actor, teamId, {
      content: toAchievementContent(dto),
    });
  }

  @Post(ACHIEVEMENT_TRANSITION_ROUTE)
  @RequirePermissions(Permission.CompetitionManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit, approve, reject, or archive a claim' })
  @ApiOkResponse({ type: AchievementResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ACHIEVEMENT_ID_PARAM, UuidValidationPipe) achievementId: string,
    @Body() dto: TransitionAchievementDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AchievementResponseDto> {
    return this.transitionAchievement.execute(actor, teamId, achievementId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(ACHIEVEMENT_IMPORT_ROUTE)
  @RequirePermissions(Permission.CompetitionManage, Permission.ImportManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import audited historical achievements' })
  @ApiOkResponse({ type: AchievementImportReportDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  import(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: ImportAchievementsDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AchievementImportReportDto> {
    return this.importAchievements.execute(actor, teamId, {
      dryRun: dto.dryRun ?? true,
      rows: toAchievementImportRows(dto.rows),
    });
  }
}
