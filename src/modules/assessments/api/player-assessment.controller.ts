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

import { CorrectPlayerAssessmentUseCase } from '../application/correct-player-assessment.use-case';
import { CreatePlayerAssessmentUseCase } from '../application/create-player-assessment.use-case';
import { PlayerAssessmentQueryService } from '../application/player-assessment-query.service';
import { PublishPlayerAssessmentUseCase } from '../application/publish-player-assessment.use-case';
import { ReviewPlayerAssessmentUseCase } from '../application/review-player-assessment.use-case';
import { SubmitPlayerAssessmentUseCase } from '../application/submit-player-assessment.use-case';
import { UpdatePlayerAssessmentUseCase } from '../application/update-player-assessment.use-case';
import { resolveAssessmentPage } from '../lib/assessments.helpers';
import {
  ASSESSMENTS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/assessments.constants';
import {
  ASSESSMENT_CORRECT_ROUTE,
  ASSESSMENT_DETAIL_ROUTE,
  ASSESSMENT_ID_PARAM,
  ASSESSMENT_PUBLISH_ROUTE,
  ASSESSMENT_REVIEW_ROUTE,
  ASSESSMENT_REVISIONS_ROUTE,
  ASSESSMENT_SUBMIT_ROUTE,
  ASSESSMENT_VALUES_ROUTE,
  PLAYER_ASSESSMENTS_ROUTE,
} from '../model/player-assessments.constants';
import { CorrectPlayerAssessmentDto } from './dto/correct-player-assessment.dto';
import { CreatePlayerAssessmentDto } from './dto/create-player-assessment.dto';
import { ListCatalogQueryDto } from './dto/list-catalog.query.dto';
import { ListPlayerAssessmentsResponseDto } from './dto/list-player-assessments.response.dto';
import { AssessmentOptimisticVersionDto } from './dto/optimistic-version.dto';
import { PlayerAssessmentResponseDto } from './dto/player-assessment-response.dto';
import { ReviewPlayerAssessmentDto } from './dto/review-player-assessment.dto';
import { RevisionsResponseDto } from './dto/revisions-response.dto';
import { UpdatePlayerAssessmentDto } from './dto/update-player-assessment.dto';

@ApiTags(ASSESSMENTS_API_TAG)
@Controller(PLAYER_ASSESSMENTS_ROUTE)
export class PlayerAssessmentController {
  constructor(
    private readonly query: PlayerAssessmentQueryService,
    private readonly createAssessment: CreatePlayerAssessmentUseCase,
    private readonly updateAssessment: UpdatePlayerAssessmentUseCase,
    private readonly submitAssessment: SubmitPlayerAssessmentUseCase,
    private readonly reviewAssessment: ReviewPlayerAssessmentUseCase,
    private readonly publishAssessment: PublishPlayerAssessmentUseCase,
    private readonly correctAssessment: CorrectPlayerAssessmentUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.AssessmentReadTeam)
  @ApiOperation({ summary: 'List a team’s player assessments' })
  @ApiOkResponse({ type: ListPlayerAssessmentsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListCatalogQueryDto,
  ): Promise<ListPlayerAssessmentsResponseDto> {
    return this.query.listForTeam(
      teamId,
      resolveAssessmentPage(query.limit, query.offset),
    );
  }

  @Get(ASSESSMENT_DETAIL_ROUTE)
  @RequirePermissions(Permission.AssessmentReadTeam)
  @ApiOperation({ summary: 'Read one player assessment with its values' })
  @ApiOkResponse({ type: PlayerAssessmentResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  detail(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ASSESSMENT_ID_PARAM, UuidValidationPipe) assessmentId: string,
  ): Promise<PlayerAssessmentResponseDto> {
    return this.query.getDetail(teamId, assessmentId);
  }

  @Get(ASSESSMENT_REVISIONS_ROUTE)
  @RequirePermissions(Permission.AssessmentReadTeam)
  @ApiOperation({
    summary: 'List the revision history of an assessment family',
  })
  @ApiOkResponse({ type: RevisionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  revisions(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ASSESSMENT_ID_PARAM, UuidValidationPipe) assessmentId: string,
  ): Promise<RevisionsResponseDto> {
    return this.query.listRevisions(teamId, assessmentId);
  }

  @Post()
  @RequirePermissions(Permission.AssessmentCreate)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft player assessment' })
  @ApiCreatedResponse({ type: PlayerAssessmentResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreatePlayerAssessmentDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PlayerAssessmentResponseDto> {
    return this.createAssessment.execute(actor, teamId, {
      periodId: dto.periodId,
      membershipId: dto.membershipId,
      summary: dto.summary ?? null,
      values: (dto.values ?? []).map(value => ({
        metricDefinitionId: value.metricDefinitionId,
        numericValue: value.numericValue ?? null,
        textValue: value.textValue ?? null,
        note: value.note ?? null,
        confidence: value.confidence ?? null,
        observationCount: value.observationCount ?? null,
      })),
    });
  }

  @Put(ASSESSMENT_VALUES_ROUTE)
  @RequirePermissions(Permission.AssessmentCreate)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autosave a draft assessment’s values' })
  @ApiOkResponse({ type: PlayerAssessmentResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ASSESSMENT_ID_PARAM, UuidValidationPipe) assessmentId: string,
    @Body() dto: UpdatePlayerAssessmentDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PlayerAssessmentResponseDto> {
    return this.updateAssessment.execute(actor, teamId, assessmentId, {
      expectedRecordVersion: dto.expectedRecordVersion,
      summary: dto.summary ?? null,
      values: dto.values.map(value => ({
        metricDefinitionId: value.metricDefinitionId,
        numericValue: value.numericValue ?? null,
        textValue: value.textValue ?? null,
        note: value.note ?? null,
        confidence: value.confidence ?? null,
        observationCount: value.observationCount ?? null,
      })),
    });
  }

  @Post(ASSESSMENT_SUBMIT_ROUTE)
  @RequirePermissions(Permission.AssessmentCreate)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a draft assessment for review' })
  @ApiOkResponse({ type: PlayerAssessmentResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  submit(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ASSESSMENT_ID_PARAM, UuidValidationPipe) assessmentId: string,
    @Body() dto: AssessmentOptimisticVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PlayerAssessmentResponseDto> {
    return this.submitAssessment.execute(actor, teamId, assessmentId, {
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(ASSESSMENT_REVIEW_ROUTE)
  @RequirePermissions(Permission.AssessmentReview)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review (claim, approve, or reopen) an assessment' })
  @ApiOkResponse({ type: PlayerAssessmentResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  review(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ASSESSMENT_ID_PARAM, UuidValidationPipe) assessmentId: string,
    @Body() dto: ReviewPlayerAssessmentDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PlayerAssessmentResponseDto> {
    return this.reviewAssessment.execute(actor, teamId, assessmentId, {
      decision: dto.decision,
      expectedRecordVersion: dto.expectedRecordVersion,
      note: dto.note ?? null,
    });
  }

  @Post(ASSESSMENT_PUBLISH_ROUTE)
  @RequirePermissions(Permission.AssessmentPublish)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish an approved assessment' })
  @ApiOkResponse({ type: PlayerAssessmentResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  publish(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ASSESSMENT_ID_PARAM, UuidValidationPipe) assessmentId: string,
    @Body() dto: AssessmentOptimisticVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PlayerAssessmentResponseDto> {
    return this.publishAssessment.execute(actor, teamId, assessmentId, {
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(ASSESSMENT_CORRECT_ROUTE)
  @RequirePermissions(Permission.AssessmentCorrect)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Correct a published assessment via a new revision',
  })
  @ApiCreatedResponse({ type: PlayerAssessmentResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  correct(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ASSESSMENT_ID_PARAM, UuidValidationPipe) assessmentId: string,
    @Body() dto: CorrectPlayerAssessmentDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PlayerAssessmentResponseDto> {
    return this.correctAssessment.execute(actor, teamId, assessmentId, {
      reason: dto.reason,
      summary: dto.summary ?? null,
      values: dto.values.map(value => ({
        metricDefinitionId: value.metricDefinitionId,
        numericValue: value.numericValue ?? null,
        textValue: value.textValue ?? null,
        note: value.note ?? null,
        confidence: value.confidence ?? null,
        observationCount: value.observationCount ?? null,
      })),
    });
  }
}
