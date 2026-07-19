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
  Put,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { CorrectFeedbackUseCase } from '../application/correct-feedback.use-case';
import { CreateFeedbackUseCase } from '../application/create-feedback.use-case';
import { FeedbackQueryService } from '../application/feedback-query.service';
import { PublishFeedbackUseCase } from '../application/publish-feedback.use-case';
import { SubmitFeedbackUseCase } from '../application/submit-feedback.use-case';
import { UpdateFeedbackUseCase } from '../application/update-feedback.use-case';
import { resolveDevelopmentPage } from '../lib/development.helpers';
import { toFeedbackFields } from '../lib/development-command.mapper';
import {
  COACH_FEEDBACK_ROUTE,
  DEVELOPMENT_API_TAG,
  FEEDBACK_CORRECT_ROUTE,
  FEEDBACK_DETAIL_ROUTE,
  FEEDBACK_FIELDS_ROUTE,
  FEEDBACK_ID_PARAM,
  FEEDBACK_PUBLISH_ROUTE,
  FEEDBACK_REVISIONS_ROUTE,
  FEEDBACK_SUBMIT_ROUTE,
  TEAM_ID_PARAM,
} from '../model/development.constants';
import { CoachFeedbackResponseDto } from './dto/coach-feedback-response.dto';
import { CorrectFeedbackDto } from './dto/correct-feedback.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackRevisionsResponseDto } from './dto/feedback-revisions.response.dto';
import { ListCoachFeedbackResponseDto } from './dto/list-coach-feedback.response.dto';
import { ListDevelopmentQueryDto } from './dto/list-development.query.dto';
import { OptimisticVersionDto } from './dto/optimistic-version.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

/**
 * Team-facing coach-feedback surface for feedback managers (feedback.manage).
 * The broad list returns note-free summaries; the detail view returns the full
 * record including the private coach note, which is scoped to managers only.
 */
@ApiTags(DEVELOPMENT_API_TAG)
@Controller(COACH_FEEDBACK_ROUTE)
export class CoachFeedbackController {
  constructor(
    private readonly query: FeedbackQueryService,
    private readonly createFeedback: CreateFeedbackUseCase,
    private readonly updateFeedback: UpdateFeedbackUseCase,
    private readonly submitFeedback: SubmitFeedbackUseCase,
    private readonly publishFeedback: PublishFeedbackUseCase,
    private readonly correctFeedback: CorrectFeedbackUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.FeedbackManage)
  @ApiOperation({
    summary: 'List a team’s coach feedback (note-free summaries)',
  })
  @ApiOkResponse({ type: ListCoachFeedbackResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListDevelopmentQueryDto,
  ): Promise<ListCoachFeedbackResponseDto> {
    return this.query.listForTeam(
      teamId,
      resolveDevelopmentPage(query.limit, query.offset),
    );
  }

  @Get(FEEDBACK_DETAIL_ROUTE)
  @RequirePermissions(Permission.FeedbackManage)
  @ApiOperation({ summary: 'Read one coach feedback with its coach note' })
  @ApiOkResponse({ type: CoachFeedbackResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  detail(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(FEEDBACK_ID_PARAM, UuidValidationPipe) feedbackId: string,
  ): Promise<CoachFeedbackResponseDto> {
    return this.query.getDetail(teamId, feedbackId);
  }

  @Get(FEEDBACK_REVISIONS_ROUTE)
  @RequirePermissions(Permission.FeedbackManage)
  @ApiOperation({ summary: 'List the revision history of a feedback family' })
  @ApiOkResponse({ type: FeedbackRevisionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  revisions(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(FEEDBACK_ID_PARAM, UuidValidationPipe) feedbackId: string,
  ): Promise<FeedbackRevisionsResponseDto> {
    return this.query.listRevisions(teamId, feedbackId);
  }

  @Post()
  @RequirePermissions(Permission.FeedbackManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft coach feedback' })
  @ApiCreatedResponse({ type: CoachFeedbackResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CoachFeedbackResponseDto> {
    return this.createFeedback.execute(actor, teamId, {
      membershipId: dto.membershipId,
      seasonId: dto.seasonId ?? null,
      fields: toFeedbackFields(dto.fields),
    });
  }

  @Put(FEEDBACK_FIELDS_ROUTE)
  @RequirePermissions(Permission.FeedbackManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autosave a draft feedback’s structured fields' })
  @ApiOkResponse({ type: CoachFeedbackResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(FEEDBACK_ID_PARAM, UuidValidationPipe) feedbackId: string,
    @Body() dto: UpdateFeedbackDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CoachFeedbackResponseDto> {
    return this.updateFeedback.execute(actor, teamId, feedbackId, {
      expectedRecordVersion: dto.expectedRecordVersion,
      fields: toFeedbackFields(dto.fields),
    });
  }

  @Post(FEEDBACK_SUBMIT_ROUTE)
  @RequirePermissions(Permission.FeedbackManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a draft feedback for review' })
  @ApiOkResponse({ type: CoachFeedbackResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  submit(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(FEEDBACK_ID_PARAM, UuidValidationPipe) feedbackId: string,
    @Body() dto: OptimisticVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CoachFeedbackResponseDto> {
    return this.submitFeedback.execute(actor, teamId, feedbackId, {
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(FEEDBACK_PUBLISH_ROUTE)
  @RequirePermissions(Permission.FeedbackManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish (share) an in-review feedback' })
  @ApiOkResponse({ type: CoachFeedbackResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  publish(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(FEEDBACK_ID_PARAM, UuidValidationPipe) feedbackId: string,
    @Body() dto: OptimisticVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CoachFeedbackResponseDto> {
    return this.publishFeedback.execute(actor, teamId, feedbackId, {
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(FEEDBACK_CORRECT_ROUTE)
  @RequirePermissions(Permission.FeedbackManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Correct a published feedback via a new revision' })
  @ApiCreatedResponse({ type: CoachFeedbackResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  correct(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(FEEDBACK_ID_PARAM, UuidValidationPipe) feedbackId: string,
    @Body() dto: CorrectFeedbackDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CoachFeedbackResponseDto> {
    return this.correctFeedback.execute(actor, teamId, feedbackId, {
      reason: dto.reason,
      fields: toFeedbackFields(dto.fields),
    });
  }
}
