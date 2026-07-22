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

import { RegisterVideoSourceUseCase } from '../application/register-video-source.use-case';
import { VideoAccessService } from '../application/video-access.service';
import { VideoSourceQueryService } from '../application/video-source-query.service';
import { resolveAnalysisPage } from '../lib/analysis.helpers';
import {
  toVideoSourceContent,
  toVideoSourceListFilter,
} from '../lib/analysis-command.mapper';
import {
  ANALYSIS_API_TAG,
  SOURCE_ACCESS_ROUTE,
  SOURCE_ID_PARAM,
  SOURCE_ITEM_ROUTE,
  TEAM_ID_PARAM,
  VIDEO_SOURCES_ROUTE,
} from '../model/analysis.constants';
import {
  ListVideoSourcesResponseDto,
  RegisterVideoSourceDto,
  VideoAccessResponseDto,
  VideoSourceListQueryDto,
  VideoSourceResponseDto,
} from './dto/analysis.dto';

/**
 * HTTP surface for registered match recordings: bounded reads and the signed
 * provider handle (match.analysis.read.self — the source's own access policy
 * narrows it further), and registration (match.analysis.manage). The API never
 * proxies video; the access route returns a short-lived provider URL.
 */
@ApiTags(ANALYSIS_API_TAG)
@Controller(VIDEO_SOURCES_ROUTE)
export class VideoSourcesController {
  constructor(
    private readonly query: VideoSourceQueryService,
    private readonly access: VideoAccessService,
    private readonly registerSource: RegisterVideoSourceUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.MatchAnalysisReadTeam)
  @ApiOperation({ summary: 'List a team’s registered match recordings' })
  @ApiOkResponse({ type: ListVideoSourcesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: VideoSourceListQueryDto,
  ): Promise<ListVideoSourcesResponseDto> {
    return this.query.listForScope(
      teamId,
      toVideoSourceListFilter(query),
      resolveAnalysisPage(query.limit, query.offset),
    );
  }

  @Get(SOURCE_ITEM_ROUTE)
  @RequirePermissions(Permission.MatchAnalysisReadTeam)
  @ApiOperation({ summary: 'Get one registered recording' })
  @ApiOkResponse({ type: VideoSourceResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SOURCE_ID_PARAM, UuidValidationPipe) sourceId: string,
  ): Promise<VideoSourceResponseDto> {
    return this.query.getById(teamId, sourceId);
  }

  @Get(SOURCE_ACCESS_ROUTE)
  @RequirePermissions(Permission.MatchAnalysisReadSelf)
  @ApiOperation({ summary: 'Mint a short-lived signed provider handle' })
  @ApiOkResponse({ type: VideoAccessResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  grantAccess(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SOURCE_ID_PARAM, UuidValidationPipe) sourceId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<VideoAccessResponseDto> {
    return this.access.grant(actor, teamId, sourceId);
  }

  @Post()
  @RequirePermissions(Permission.MatchAnalysisManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a match recording' })
  @ApiCreatedResponse({ type: VideoSourceResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  register(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: RegisterVideoSourceDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<VideoSourceResponseDto> {
    return this.registerSource.execute(actor, teamId, {
      content: toVideoSourceContent(dto),
    });
  }
}
