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

import { ConvertCandidateUseCase } from '../application/convert-candidate.use-case';
import { ManageCandidateUseCase } from '../application/manage-candidate.use-case';
import { ManageOfferUseCase } from '../application/manage-offer.use-case';
import { RecordDecisionUseCase } from '../application/record-decision.use-case';
import { RegisterCandidateUseCase } from '../application/register-candidate.use-case';
import { SubmitEvaluationUseCase } from '../application/submit-evaluation.use-case';
import { TryoutQueryService } from '../application/tryout-query.service';
import { resolveTryoutsPage } from '../lib/tryouts.helpers';
import {
  toCandidateContent,
  toCandidateListFilter,
  toEvaluationContent,
} from '../lib/tryouts-command.mapper';
import {
  CANDIDATE_CHECK_IN_ROUTE,
  CANDIDATE_CONVERSION_ROUTE,
  CANDIDATE_DECISION_ROUTE,
  CANDIDATE_EVALUATION_ROUTE,
  CANDIDATE_ID_PARAM,
  CANDIDATE_ITEM_ROUTE,
  CANDIDATE_OFFER_ROUTE,
  CANDIDATE_RETENTION_ROUTE,
  CANDIDATE_WITHDRAWAL_ROUTE,
  TEAM_ID_PARAM,
  TRYOUT_CANDIDATES_ROUTE,
  TRYOUTS_API_TAG,
} from '../model/tryouts.constants';
import {
  CandidateConversionResponseDto,
  CandidateListQueryDto,
  CandidateVersionDto,
  ConvertCandidateDto,
  EvaluationAggregateResponseDto,
  ListTryoutCandidatesResponseDto,
  ManageTryoutOfferDto,
  RecordTryoutDecisionDto,
  RegisterCandidateDto,
  SubmitEvaluationDto,
  TryoutCandidateResponseDto,
  TryoutDecisionResponseDto,
  TryoutEvaluationResponseDto,
  TryoutOfferResponseDto,
  TryoutRetentionResponseDto,
  WithdrawCandidateDto,
} from './dto/tryouts.dto';

/**
 * HTTP surface for tryout candidates and the selection workflow. Reads are
 * tryout.manage and the application redacts contacts and health fields unless
 * the caller also holds tryout.contacts.read / tryout.readiness.read.
 * Evaluations need tryout.evaluate, decisions tryout.decide, and conversion
 * tryout.convert — a single permission can never take a candidate from
 * registration to membership on its own.
 */
@ApiTags(TRYOUTS_API_TAG)
@Controller(TRYOUT_CANDIDATES_ROUTE)
export class TryoutCandidatesController {
  constructor(
    private readonly query: TryoutQueryService,
    private readonly register: RegisterCandidateUseCase,
    private readonly candidates: ManageCandidateUseCase,
    private readonly evaluations: SubmitEvaluationUseCase,
    private readonly decisions: RecordDecisionUseCase,
    private readonly offers: ManageOfferUseCase,
    private readonly conversion: ConvertCandidateUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.TryoutManage)
  @ApiOperation({ summary: 'List tryout candidates (privacy redacted)' })
  @ApiOkResponse({ type: ListTryoutCandidatesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: CandidateListQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ListTryoutCandidatesResponseDto> {
    return this.query.listCandidates(
      actor,
      teamId,
      toCandidateListFilter(query),
      resolveTryoutsPage(query.limit, query.offset),
    );
  }

  @Get(CANDIDATE_ITEM_ROUTE)
  @RequirePermissions(Permission.TryoutManage)
  @ApiOperation({ summary: 'Get one candidate (privacy redacted)' })
  @ApiOkResponse({ type: TryoutCandidateResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CANDIDATE_ID_PARAM, UuidValidationPipe) candidateId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TryoutCandidateResponseDto> {
    return this.query.getCandidate(actor, teamId, candidateId);
  }

  @Post()
  @RequirePermissions(Permission.TryoutPublicRegister)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a candidate for a tryout event' })
  @ApiCreatedResponse({ type: TryoutCandidateResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: RegisterCandidateDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TryoutCandidateResponseDto> {
    return this.register.execute(actor, teamId, {
      content: toCandidateContent(dto),
    });
  }

  @Post(CANDIDATE_RETENTION_ROUTE)
  @RequirePermissions(Permission.TryoutManage, Permission.DataQualityManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anonymize candidates past their retention window' })
  @ApiOkResponse({ type: TryoutRetentionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  runRetention(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TryoutRetentionResponseDto> {
    return this.candidates.runRetention(actor, teamId);
  }

  @Post(CANDIDATE_CHECK_IN_ROUTE)
  @RequirePermissions(Permission.TryoutManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check a candidate in at the session' })
  @ApiOkResponse({ type: TryoutCandidateResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  checkIn(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CANDIDATE_ID_PARAM, UuidValidationPipe) candidateId: string,
    @Body() dto: CandidateVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TryoutCandidateResponseDto> {
    return this.candidates.checkIn(
      actor,
      teamId,
      candidateId,
      dto.expectedRecordVersion,
    );
  }

  @Post(CANDIDATE_WITHDRAWAL_ROUTE)
  @RequirePermissions(Permission.TryoutManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw a candidate' })
  @ApiOkResponse({ type: TryoutCandidateResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  withdraw(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CANDIDATE_ID_PARAM, UuidValidationPipe) candidateId: string,
    @Body() dto: WithdrawCandidateDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TryoutCandidateResponseDto> {
    return this.candidates.withdraw(actor, teamId, candidateId, {
      reason: dto.reason,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Get(CANDIDATE_EVALUATION_ROUTE)
  @RequirePermissions(Permission.TryoutEvaluate)
  @ApiOperation({ summary: 'Read the multi-evaluator aggregate' })
  @ApiOkResponse({ type: EvaluationAggregateResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  aggregate(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CANDIDATE_ID_PARAM, UuidValidationPipe) candidateId: string,
  ): Promise<EvaluationAggregateResponseDto> {
    return this.evaluations.aggregate(teamId, candidateId);
  }

  @Post(CANDIDATE_EVALUATION_ROUTE)
  @RequirePermissions(Permission.TryoutEvaluate)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record this evaluator’s original observation' })
  @ApiOkResponse({ type: TryoutEvaluationResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  evaluate(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CANDIDATE_ID_PARAM, UuidValidationPipe) candidateId: string,
    @Body() dto: SubmitEvaluationDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TryoutEvaluationResponseDto> {
    return this.evaluations.execute(actor, teamId, candidateId, {
      content: toEvaluationContent(dto),
    });
  }

  @Post(CANDIDATE_DECISION_ROUTE)
  @RequirePermissions(Permission.TryoutDecide)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record the committee’s human decision' })
  @ApiCreatedResponse({ type: TryoutDecisionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  decide(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CANDIDATE_ID_PARAM, UuidValidationPipe) candidateId: string,
    @Body() dto: RecordTryoutDecisionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TryoutDecisionResponseDto> {
    return this.decisions.execute(actor, teamId, candidateId, {
      decision: dto.decision,
      reasons: dto.reasons,
      criteriaVersion: dto.criteriaVersion,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(CANDIDATE_OFFER_ROUTE)
  @RequirePermissions(Permission.TryoutDecide)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send or resolve a candidate-facing offer' })
  @ApiOkResponse({ type: TryoutOfferResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  offer(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CANDIDATE_ID_PARAM, UuidValidationPipe) candidateId: string,
    @Body() dto: ManageTryoutOfferDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TryoutOfferResponseDto> {
    return this.offers.execute(actor, teamId, candidateId, {
      transition: dto.transition,
      candidateMessage: dto.candidateMessage ?? null,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(CANDIDATE_CONVERSION_ROUTE)
  @RequirePermissions(Permission.TryoutConvert)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convert an accepted candidate exactly once' })
  @ApiOkResponse({ type: CandidateConversionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  convert(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(CANDIDATE_ID_PARAM, UuidValidationPipe) candidateId: string,
    @Body() dto: ConvertCandidateDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<CandidateConversionResponseDto> {
    return this.conversion.execute(actor, teamId, candidateId, {
      seasonId: dto.seasonId ?? null,
      userId: dto.userId ?? null,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
