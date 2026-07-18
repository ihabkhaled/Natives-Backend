import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { PlayerAssessmentQueryService } from '../application/player-assessment-query.service';
import { resolveAssessmentPage } from '../lib/assessments.helpers';
import {
  ASSESSMENTS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/assessments.constants';
import { MY_ASSESSMENTS_ROUTE } from '../model/player-assessments.constants';
import { ListCatalogQueryDto } from './dto/list-catalog.query.dto';
import { ListPublishedAssessmentsResponseDto } from './dto/list-published-assessments.response.dto';

/**
 * Player self-service read surface. A player sees ONLY their own PUBLISHED (or
 * revised) assessments in the team, shaped to exclude private evaluator notes.
 * Ownership is resolved from the authenticated identity against the membership's
 * account link — never from a client-supplied id.
 */
@ApiTags(ASSESSMENTS_API_TAG)
@Controller(MY_ASSESSMENTS_ROUTE)
export class PlayerAssessmentSelfController {
  constructor(private readonly query: PlayerAssessmentQueryService) {}

  @Get()
  @RequirePermissions(Permission.AssessmentReadSelfPublished)
  @ApiOperation({ summary: 'List my own published assessments for a team' })
  @ApiOkResponse({ type: ListPublishedAssessmentsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listOwn(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListCatalogQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ListPublishedAssessmentsResponseDto> {
    return this.query.listOwnPublished(
      teamId,
      actor.userId,
      resolveAssessmentPage(query.limit, query.offset),
    );
  }
}
