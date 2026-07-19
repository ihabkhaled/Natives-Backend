import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
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

import { ClaimReviewUseCase } from '../application/claim-review.use-case';
import { CorrectSubmissionUseCase } from '../application/correct-submission.use-case';
import { RecordReviewDecisionUseCase } from '../application/record-review-decision.use-case';
import { ReviewQueueService } from '../application/review-queue.service';
import { resolveActivityPage } from '../lib/activity.helpers';
import {
  toReviewCorrectionCommand,
  toReviewDecisionCommand,
  toReviewQueueQuery,
} from '../lib/activity-command.mapper';
import {
  ACTIVITIES_API_TAG,
  ACTIVITY_REVIEW_ROUTE,
  REVIEW_APPROVE_ROUTE,
  REVIEW_CLAIM_ROUTE,
  REVIEW_CORRECT_ROUTE,
  REVIEW_DETAIL_ROUTE,
  REVIEW_REJECT_ROUTE,
  REVIEW_REQUEST_CHANGES_ROUTE,
  SUBMISSION_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/activities.constants';
import { ReviewDecision } from '../model/activity.enums';
import { CorrectSubmissionDto } from './dto/correct-submission.dto';
import { ListReviewQueueQueryDto } from './dto/list-review-queue.query.dto';
import { ListReviewQueueResponseDto } from './dto/list-review-queue.response.dto';
import { OptimisticVersionDto } from './dto/optimistic-version.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';
import { ReviewDetailResponseDto } from './dto/review-detail-response.dto';

/**
 * Reviewer moderation surface (activity.review / activity.correct). Identity is
 * taken from the token, never the body, and every mutation proves — server-side —
 * that the reviewer is neither the submitter nor a credited buddy. The queue is
 * bounded, allowlisted, and deterministically ordered.
 */
@ApiTags(ACTIVITIES_API_TAG)
@Controller(ACTIVITY_REVIEW_ROUTE)
export class ActivityReviewController {
  constructor(
    private readonly queue: ReviewQueueService,
    private readonly claimReview: ClaimReviewUseCase,
    private readonly recordDecision: RecordReviewDecisionUseCase,
    private readonly correctSubmission: CorrectSubmissionUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.ActivityReview)
  @ApiOperation({ summary: 'List the reviewer queue (bounded, filterable)' })
  @ApiOkResponse({ type: ListReviewQueueResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListReviewQueueQueryDto,
  ): Promise<ListReviewQueueResponseDto> {
    return this.queue.listQueue(
      teamId,
      toReviewQueueQuery(
        query.status,
        query.activityTypeId,
        query.membershipId,
        resolveActivityPage(query.limit, query.offset),
      ),
    );
  }

  @Get(REVIEW_DETAIL_ROUTE)
  @RequirePermissions(Permission.ActivityReview)
  @ApiOperation({ summary: 'Read a submission for review with abuse signals' })
  @ApiOkResponse({ type: ReviewDetailResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  detail(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
  ): Promise<ReviewDetailResponseDto> {
    return this.queue.getDetail(teamId, submissionId);
  }

  @Post(REVIEW_CLAIM_ROUTE)
  @RequirePermissions(Permission.ActivityReview)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim a submitted claim into review' })
  @ApiOkResponse({ type: ReviewDetailResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  claim(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
    @Body() dto: OptimisticVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReviewDetailResponseDto> {
    return this.claimReview.execute(actor, teamId, submissionId, dto);
  }

  @Post(REVIEW_APPROVE_ROUTE)
  @RequirePermissions(Permission.ActivityReview)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a submitted or under-review claim' })
  @ApiOkResponse({ type: ReviewDetailResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  approve(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReviewDetailResponseDto> {
    return this.recordDecision.execute(
      actor,
      teamId,
      submissionId,
      toReviewDecisionCommand(dto, ReviewDecision.Approve),
    );
  }

  @Post(REVIEW_REJECT_ROUTE)
  @RequirePermissions(Permission.ActivityReview)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a claim with a required reviewer note' })
  @ApiOkResponse({ type: ReviewDetailResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  reject(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReviewDetailResponseDto> {
    return this.recordDecision.execute(
      actor,
      teamId,
      submissionId,
      toReviewDecisionCommand(dto, ReviewDecision.Reject),
    );
  }

  @Post(REVIEW_REQUEST_CHANGES_ROUTE)
  @RequirePermissions(Permission.ActivityReview)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Return a claim for changes with a required note' })
  @ApiOkResponse({ type: ReviewDetailResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  requestChanges(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReviewDetailResponseDto> {
    return this.recordDecision.execute(
      actor,
      teamId,
      submissionId,
      toReviewDecisionCommand(dto, ReviewDecision.RequestChanges),
    );
  }

  @Post(REVIEW_CORRECT_ROUTE)
  @RequirePermissions(Permission.ActivityCorrect)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Correct an approved claim via a compensating reversal',
  })
  @ApiOkResponse({ type: ReviewDetailResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  correct(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
    @Body() dto: CorrectSubmissionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReviewDetailResponseDto> {
    return this.correctSubmission.execute(
      actor,
      teamId,
      submissionId,
      toReviewCorrectionCommand(dto),
    );
  }
}
