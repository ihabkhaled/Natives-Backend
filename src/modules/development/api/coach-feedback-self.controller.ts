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

import { AcknowledgeFeedbackUseCase } from '../application/acknowledge-feedback.use-case';
import { FeedbackQueryService } from '../application/feedback-query.service';
import { resolveDevelopmentPage } from '../lib/development.helpers';
import {
  DEVELOPMENT_API_TAG,
  FEEDBACK_ACKNOWLEDGE_ROUTE,
  FEEDBACK_ID_PARAM,
  MY_FEEDBACK_ROUTE,
  TEAM_ID_PARAM,
} from '../model/development.constants';
import { AcknowledgeFeedbackDto } from './dto/acknowledge-feedback.dto';
import { FeedbackAcknowledgementResponseDto } from './dto/feedback-acknowledgement-response.dto';
import { ListDevelopmentQueryDto } from './dto/list-development.query.dto';
import { ListSharedFeedbackResponseDto } from './dto/list-shared-feedback.response.dto';

/**
 * Member self-service surface. A member sees ONLY the coach feedback shared WITH
 * them (their own published/revised records), shaped to exclude the private coach
 * note, and may acknowledge it or request clarification. Ownership is resolved
 * from the authenticated identity — never from a client-supplied id.
 */
@ApiTags(DEVELOPMENT_API_TAG)
@Controller(MY_FEEDBACK_ROUTE)
export class CoachFeedbackSelfController {
  constructor(
    private readonly query: FeedbackQueryService,
    private readonly acknowledgeFeedback: AcknowledgeFeedbackUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.FeedbackReadSelf)
  @ApiOperation({ summary: 'List my own shared feedback for a team' })
  @ApiOkResponse({ type: ListSharedFeedbackResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listOwn(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListDevelopmentQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ListSharedFeedbackResponseDto> {
    return this.query.listOwnShared(
      teamId,
      actor.userId,
      resolveDevelopmentPage(query.limit, query.offset),
    );
  }

  @Post(FEEDBACK_ACKNOWLEDGE_ROUTE)
  @RequirePermissions(Permission.FeedbackReadSelf)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge feedback shared with me' })
  @ApiOkResponse({ type: FeedbackAcknowledgementResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  acknowledge(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(FEEDBACK_ID_PARAM, UuidValidationPipe) feedbackId: string,
    @Body() dto: AcknowledgeFeedbackDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<FeedbackAcknowledgementResponseDto> {
    return this.acknowledgeFeedback.execute(actor, teamId, feedbackId, {
      clarificationRequested: dto.clarificationRequested ?? false,
      clarificationNote: dto.clarificationNote ?? null,
    });
  }
}
