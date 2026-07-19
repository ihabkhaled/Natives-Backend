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
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { CreateSubmissionUseCase } from '../application/create-submission.use-case';
import { SubmissionQueryService } from '../application/submission-query.service';
import { SubmitSubmissionUseCase } from '../application/submit-submission.use-case';
import { UpdateSubmissionUseCase } from '../application/update-submission.use-case';
import { WithdrawSubmissionUseCase } from '../application/withdraw-submission.use-case';
import { resolveActivityPage } from '../lib/activity.helpers';
import {
  toBuddyMembershipIds,
  toEvidenceItems,
  toSubmissionContent,
} from '../lib/activity-command.mapper';
import {
  ACTIVITIES_API_TAG,
  ACTIVITY_SUBMISSIONS_ROUTE,
  SUBMISSION_DETAIL_ROUTE,
  SUBMISSION_ID_PARAM,
  SUBMISSION_SUBMIT_ROUTE,
  SUBMISSION_WITHDRAW_ROUTE,
  TEAM_ID_PARAM,
} from '../model/activities.constants';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { ListActivitiesQueryDto } from './dto/list-activities.query.dto';
import { ListSubmissionsResponseDto } from './dto/list-submissions.response.dto';
import { OptimisticVersionDto } from './dto/optimistic-version.dto';
import { SubmissionDetailResponseDto } from './dto/submission-detail-response.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

/**
 * Member self-service surface for external-training submissions. Identity and
 * membership are resolved from the authenticated token, never the body, so a
 * member can only ever create, read, edit, submit, or withdraw their OWN claims.
 */
@ApiTags(ACTIVITIES_API_TAG)
@Controller(ACTIVITY_SUBMISSIONS_ROUTE)
export class ActivitySubmissionController {
  constructor(
    private readonly query: SubmissionQueryService,
    private readonly createSubmission: CreateSubmissionUseCase,
    private readonly updateSubmission: UpdateSubmissionUseCase,
    private readonly submitSubmission: SubmitSubmissionUseCase,
    private readonly withdrawSubmission: WithdrawSubmissionUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.ActivityReadSelf)
  @ApiOperation({ summary: 'List my own external-training submissions' })
  @ApiOkResponse({ type: ListSubmissionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListActivitiesQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ListSubmissionsResponseDto> {
    return this.query.listForMember(
      teamId,
      actor.userId,
      resolveActivityPage(query.limit, query.offset),
    );
  }

  @Get(SUBMISSION_DETAIL_ROUTE)
  @RequirePermissions(Permission.ActivityReadSelf)
  @ApiOperation({ summary: 'Read one of my own submissions' })
  @ApiOkResponse({ type: SubmissionDetailResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  detail(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SubmissionDetailResponseDto> {
    return this.query.getOwnDetail(teamId, actor.userId, submissionId);
  }

  @Post()
  @RequirePermissions(Permission.ActivitySubmitSelf)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft external-training submission' })
  @ApiCreatedResponse({ type: SubmissionDetailResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateSubmissionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SubmissionDetailResponseDto> {
    return this.createSubmission.execute(actor, teamId, {
      content: toSubmissionContent(dto),
      buddyMembershipIds: toBuddyMembershipIds(dto.buddyMembershipIds),
      evidence: toEvidenceItems(dto.evidence),
    });
  }

  @Patch(SUBMISSION_DETAIL_ROUTE)
  @RequirePermissions(Permission.ActivitySubmitSelf)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Edit an editable draft/changes-requested submission',
  })
  @ApiOkResponse({ type: SubmissionDetailResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
    @Body() dto: UpdateSubmissionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SubmissionDetailResponseDto> {
    return this.updateSubmission.execute(actor, teamId, submissionId, {
      expectedRecordVersion: dto.expectedRecordVersion,
      content: toSubmissionContent(dto),
      evidence: toEvidenceItems(dto.evidence),
    });
  }

  @Post(SUBMISSION_SUBMIT_ROUTE)
  @RequirePermissions(Permission.ActivitySubmitSelf)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit (or resubmit) a claim for review' })
  @ApiOkResponse({ type: SubmissionDetailResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  submit(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
    @Body() dto: OptimisticVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SubmissionDetailResponseDto> {
    return this.submitSubmission.execute(actor, teamId, submissionId, {
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(SUBMISSION_WITHDRAW_ROUTE)
  @RequirePermissions(Permission.ActivitySubmitSelf)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw my own non-decided claim' })
  @ApiOkResponse({ type: SubmissionDetailResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  withdraw(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
    @Body() dto: OptimisticVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SubmissionDetailResponseDto> {
    return this.withdrawSubmission.execute(actor, teamId, submissionId, {
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
