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

import { AcknowledgeVideoClipUseCase } from '../application/acknowledge-video-clip.use-case';
import { CreateVideoClipUseCase } from '../application/create-video-clip.use-case';
import { ImportVideoClipsUseCase } from '../application/import-video-clips.use-case';
import { ReviseVideoClipUseCase } from '../application/revise-video-clip.use-case';
import { TransitionVideoClipUseCase } from '../application/transition-video-clip.use-case';
import { VideoClipQueryService } from '../application/video-clip-query.service';
import { resolveAnalysisPage } from '../lib/analysis.helpers';
import {
  toClipImportRows,
  toVideoClipContent,
  toVideoClipListFilter,
} from '../lib/analysis-command.mapper';
import {
  ANALYSIS_API_TAG,
  CLIP_ACKNOWLEDGEMENT_ROUTE,
  CLIP_ID_PARAM,
  CLIP_IMPORT_ROUTE,
  CLIP_ITEM_ROUTE,
  CLIP_REVISION_ROUTE,
  CLIP_TRANSITION_ROUTE,
  TEAM_ID_PARAM,
  VIDEO_CLIPS_ROUTE,
} from '../model/analysis.constants';
import {
  ClipImportReportDto,
  ImportVideoClipsDto,
  ListVideoClipsResponseDto,
  ReviseVideoClipDto,
  TransitionVideoClipDto,
  VideoClipContentDto,
  VideoClipListQueryDto,
  VideoClipResponseDto,
} from './dto/analysis.dto';

/**
 * HTTP surface for timestamped analysis clips: the filtered queue and one clip
 * (match.analysis.read.self — the application then applies the visibility policy
 * so a player only ever receives published analysis addressed to them),
 * authoring, review transitions, revisions, and the audited legacy import
 * (match.analysis.manage), plus a player's own acknowledgement.
 */
@ApiTags(ANALYSIS_API_TAG)
@Controller(VIDEO_CLIPS_ROUTE)
export class VideoClipsController {
  constructor(
    private readonly query: VideoClipQueryService,
    private readonly createClip: CreateVideoClipUseCase,
    private readonly transitionClip: TransitionVideoClipUseCase,
    private readonly reviseClip: ReviseVideoClipUseCase,
    private readonly acknowledgeClip: AcknowledgeVideoClipUseCase,
    private readonly importClips: ImportVideoClipsUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.MatchAnalysisReadSelf)
  @ApiOperation({ summary: 'List the analysis clips visible to the caller' })
  @ApiOkResponse({ type: ListVideoClipsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: VideoClipListQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ListVideoClipsResponseDto> {
    return this.query.listForScope(
      actor,
      teamId,
      toVideoClipListFilter(query),
      resolveAnalysisPage(query.limit, query.offset),
    );
  }

  @Get(CLIP_ITEM_ROUTE)
  @RequirePermissions(Permission.MatchAnalysisReadSelf)
  @ApiOperation({ summary: 'Get one analysis clip' })
  @ApiOkResponse({ type: VideoClipResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CLIP_ID_PARAM, UuidValidationPipe) clipId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<VideoClipResponseDto> {
    return this.query.getById(actor, teamId, clipId);
  }

  @Post()
  @RequirePermissions(Permission.MatchAnalysisManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft analysis clip' })
  @ApiCreatedResponse({ type: VideoClipResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: VideoClipContentDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<VideoClipResponseDto> {
    return this.createClip.execute(actor, teamId, {
      content: toVideoClipContent(dto),
    });
  }

  @Post(CLIP_TRANSITION_ROUTE)
  @RequirePermissions(Permission.MatchAnalysisManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit, publish, or archive an analysis clip' })
  @ApiOkResponse({ type: VideoClipResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CLIP_ID_PARAM, UuidValidationPipe) clipId: string,
    @Body() dto: TransitionVideoClipDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<VideoClipResponseDto> {
    return this.transitionClip.execute(actor, teamId, clipId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(CLIP_REVISION_ROUTE)
  @RequirePermissions(Permission.MatchAnalysisManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Supersede a published clip with a revision' })
  @ApiCreatedResponse({ type: VideoClipResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  revise(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CLIP_ID_PARAM, UuidValidationPipe) clipId: string,
    @Body() dto: ReviseVideoClipDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<VideoClipResponseDto> {
    return this.reviseClip.execute(actor, teamId, clipId, {
      content: toVideoClipContent(dto.content),
      reason: dto.reason,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(CLIP_ACKNOWLEDGEMENT_ROUTE)
  @RequirePermissions(Permission.MatchAnalysisReadSelf)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge an analysis clip addressed to you' })
  @ApiOkResponse({ type: VideoClipResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  acknowledge(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CLIP_ID_PARAM, UuidValidationPipe) clipId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<VideoClipResponseDto> {
    return this.acknowledgeClip.execute(actor, teamId, clipId);
  }

  @Post(CLIP_IMPORT_ROUTE)
  @RequirePermissions(Permission.MatchAnalysisManage, Permission.ImportManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import audited legacy analysis rows' })
  @ApiOkResponse({ type: ClipImportReportDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  import(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: ImportVideoClipsDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ClipImportReportDto> {
    return this.importClips.execute(actor, teamId, {
      dryRun: dto.dryRun ?? true,
      rows: toClipImportRows(dto.rows),
    });
  }
}
